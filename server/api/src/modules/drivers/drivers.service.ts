import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriversQueryDto } from './dto/drivers-query.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';

const DRIVER_SELECT =
  'id, name, phone, role, is_blocked, is_active, vehicle, license_plate, expo_push_token, created_at, updated_at';

const ASSIGNMENT_SELECT = `
  id,
  order_id,
  driver_id,
  status,
  note,
  assigned_by,
  assigned_at,
  responded_at,
  picked_up_at,
  delivered_at,
  orders:orders!order_assignments_order_id_fkey (
    id,
    total_eur,
    status,
    customer_name,
    customer_phone,
    created_at
  ),
  driver:profiles!order_assignments_driver_id_fkey (
    id,
    name,
    phone,
    vehicle,
    license_plate
  )
`;

@Injectable()
export class DriversService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    private readonly notifications: NotificationsService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // CRUD
  // ────────────────────────────────────────────────────────────────────────

  async listDrivers(query: DriversQueryDto) {
    let qb = this.supabase
      .from('profiles')
      .select(DRIVER_SELECT)
      .eq('role', 'driver');

    if (query.search) {
      // ilike on name OR phone — Supabase requires a single .or() string.
      qb = qb.or(
        `name.ilike.%${query.search}%,phone.ilike.%${query.search}%`,
      );
    }
    if (query.active === 'true') qb = qb.eq('is_active', true);
    if (query.active === 'false') qb = qb.eq('is_active', false);

    qb = qb
      .order('created_at', { ascending: false })
      .range(query.offset, query.offset + (query.limit ?? 20) - 1);

    const { data, error } = await qb;
    if (error) throw error;
    return data ?? [];
  }

  async getDriver(id: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(DRIVER_SELECT)
      .eq('id', id)
      .eq('role', 'driver')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Driver not found');
    return data;
  }

  // Phone stays the on-the-wire format (user types "+33 6…"). Supabase auth
  // wants it without the leading "+"; the profiles row mirrors what's in
  // auth.users.phone so we strip the same way.
  private normalizePhoneForAuth(raw: string): string {
    return raw.replace(/[\s.-]/g, '').replace(/^\+/, '');
  }

  async createDriver(dto: CreateDriverDto) {
    const phoneForAuth = this.normalizePhoneForAuth(dto.phone);
    if (!/^\d{8,15}$/.test(phoneForAuth)) {
      throw new BadRequestException('Numéro de téléphone invalide');
    }

    // Reject duplicates up front so we never half-create an auth user.
    const { data: existing } = await this.supabase
      .from('profiles')
      .select('id, role')
      .eq('phone', phoneForAuth)
      .maybeSingle();
    if (existing) {
      throw new ConflictException('Un compte avec ce téléphone existe déjà');
    }

    const { data: created, error: createErr } =
      await this.supabase.auth.admin.createUser({
        phone: phoneForAuth,
        password: dto.password,
        phone_confirm: true,
        user_metadata: { name: dto.name, role: 'driver' },
      });
    if (createErr || !created.user) {
      throw new BadRequestException(
        createErr?.message ?? 'Création du compte impossible',
      );
    }

    const userId = created.user.id;

    // handle_new_user trigger inserts (id, phone) — promote the row to driver
    // and copy the rest of the form into it.
    const patch: Record<string, unknown> = {
      role: 'driver',
      name: dto.name,
      vehicle: dto.vehicle ?? null,
      license_plate: dto.license_plate ?? null,
      is_active: dto.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error: profileErr } = await this.supabase
      .from('profiles')
      .upsert({ id: userId, phone: phoneForAuth, ...patch }, { onConflict: 'id' })
      .select(DRIVER_SELECT)
      .single();
    if (profileErr) {
      // Best-effort rollback — leaving an auth user without a profile would
      // poison future re-creates by phone.
      await this.supabase.auth.admin.deleteUser(userId).catch(() => {});
      throw profileErr;
    }

    return profile;
  }

  async updateDriver(id: string, dto: UpdateDriverDto) {
    await this.getDriver(id); // 404 if missing

    if (dto.phone !== undefined) {
      const phoneForAuth = this.normalizePhoneForAuth(dto.phone);
      const { error: authErr } = await this.supabase.auth.admin.updateUserById(
        id,
        { phone: phoneForAuth, phone_confirm: true },
      );
      if (authErr) throw new BadRequestException(authErr.message);
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.phone !== undefined) {
      patch.phone = this.normalizePhoneForAuth(dto.phone);
    }
    if (dto.vehicle !== undefined) patch.vehicle = dto.vehicle;
    if (dto.license_plate !== undefined) {
      patch.license_plate = dto.license_plate;
    }
    if (dto.is_active !== undefined) patch.is_active = dto.is_active;

    const { data, error } = await this.supabase
      .from('profiles')
      .update(patch)
      .eq('id', id)
      .select(DRIVER_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  async deleteDriver(id: string) {
    await this.getDriver(id); // 404 if missing

    // Refuse to delete a driver with an unresolved assignment — otherwise the
    // FK on order_assignments.driver_id (on delete restrict) would 409.
    const { count } = await this.supabase
      .from('order_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', id)
      .in('status', ['pending', 'accepted']);
    if (count && count > 0) {
      throw new ConflictException(
        'Ce livreur a encore des courses en cours — annule-les avant de le supprimer.',
      );
    }

    const { error: authErr } = await this.supabase.auth.admin.deleteUser(id);
    if (authErr) throw new BadRequestException(authErr.message);
    // Profile row cascades from auth.users delete.
    return { deleted: true };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Assignments
  // ────────────────────────────────────────────────────────────────────────

  async listAssignmentsForDriver(driverId: string) {
    await this.getDriver(driverId);
    const { data, error } = await this.supabase
      .from('order_assignments')
      .select(ASSIGNMENT_SELECT)
      .eq('driver_id', driverId)
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listAssignmentsForOrder(orderId: string) {
    const { data, error } = await this.supabase
      .from('order_assignments')
      .select(ASSIGNMENT_SELECT)
      .eq('order_id', orderId)
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async assignOrderToDriver(
    orderId: string,
    dto: AssignDriverDto,
    assignedBy: string | null,
  ) {
    // Validate the order exists so the 404 surfaces clearly instead of a
    // generic FK violation later.
    const { data: order, error: orderErr } = await this.supabase
      .from('orders')
      .select('id, status, customer_name, total_eur, pickup_mode')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) throw new NotFoundException('Commande introuvable');

    const driver = await this.getDriver(dto.driver_id);
    // is_active is the driver-controlled online toggle. We let admin assign
    // even when the driver is offline — the row gets created so the driver
    // sees it next time they go online; only the push is suppressed below.
    // is_blocked, on the other hand, is a hard ban: don't assign to those.
    if (driver.is_blocked) {
      throw new BadRequestException(
        'Ce livreur est bloqué — débloque-le avant de lui confier une course.',
      );
    }

    // Cancel any previous pending assignment so only one is "live" at a time.
    await this.supabase
      .from('order_assignments')
      .update({
        status: 'cancelled',
        responded_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .eq('status', 'pending');

    const { data: created, error } = await this.supabase
      .from('order_assignments')
      .insert({
        order_id: orderId,
        driver_id: dto.driver_id,
        status: 'pending',
        note: dto.note ?? null,
        assigned_by: assignedBy,
      })
      .select(ASSIGNMENT_SELECT)
      .single();
    if (error) throw error;

    // Best-effort push — never block the assignment on a notification hiccup.
    // When the driver is offline (is_active=false) we deliberately skip the
    // push: the assignment row still exists and they'll see it the moment
    // they flip back online. This is the whole point of the online toggle.
    if (driver.is_active) {
      void this.notifications
        .notify(
          { kind: 'user', userIds: [dto.driver_id] },
          {
            title: 'Nouvelle course 🛵',
            body: `${order.customer_name} · ${Number(order.total_eur).toFixed(2)} €`,
            notificationKind: 'order',
            orderId: order.id,
            data: { assignmentId: created.id, kind: 'driver-assignment' },
            // Shows the Accepter / Refuser buttons directly on the lock-screen
            // notification (category registered in the app's lib/push.ts).
            categoryId: 'driver-assignment',
          },
        )
        .catch(() => {});
    }

    return created;
  }
}
