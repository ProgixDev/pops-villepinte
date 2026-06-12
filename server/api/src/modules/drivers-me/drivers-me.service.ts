import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import { OrdersService } from '../orders/orders.service';

const DRIVER_ME_SELECT =
  'id, name, phone, role, is_blocked, is_active, vehicle, license_plate, expo_push_token, created_at, updated_at';

// Same shape as the admin endpoint so the client can share one row type.
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
    delivery_fee_eur,
    status,
    pickup_mode,
    customer_name,
    customer_phone,
    delivery_address,
    delivery_lat,
    delivery_lng,
    created_at,
    estimated_ready_at
  )
`;

@Injectable()
export class DriversMeService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    private readonly orders: OrdersService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Profile
  // ────────────────────────────────────────────────────────────────────────

  async getMe(driverId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(DRIVER_ME_SELECT)
      .eq('id', driverId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Driver profile not found');
    return data;
  }

  async setOnline(driverId: string, isActive: boolean) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', driverId)
      .select('id, is_active')
      .single();
    if (error) throw error;
    return data;
  }

  async setPushToken(driverId: string, token: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', driverId)
      .select('id, expo_push_token')
      .single();
    if (error) throw error;
    return data;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Assignments
  // ────────────────────────────────────────────────────────────────────────

  async listMyAssignments(
    driverId: string,
    status?: 'pending' | 'accepted' | 'refused' | 'cancelled',
  ) {
    let qb = this.supabase
      .from('order_assignments')
      .select(ASSIGNMENT_SELECT)
      .eq('driver_id', driverId);
    if (status) qb = qb.eq('status', status);
    const { data, error } = await qb.order('assigned_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getMyAssignment(driverId: string, assignmentId: string) {
    const { data, error } = await this.supabase
      .from('order_assignments')
      .select(ASSIGNMENT_SELECT)
      .eq('id', assignmentId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Assignment not found');
    if (data.driver_id !== driverId) {
      throw new ForbiddenException('This assignment is not yours');
    }
    return data;
  }

  async respond(
    driverId: string,
    assignmentId: string,
    status: 'accepted' | 'refused',
    note?: string,
  ) {
    const current = await this.getMyAssignment(driverId, assignmentId);
    if (current.status !== 'pending') {
      throw new BadRequestException(
        `Assignment is already "${current.status}"`,
      );
    }

    // One delivery at a time. Before accepting, make sure the driver has no
    // other in-flight course — an assignment is in flight while it's 'accepted'
    // and not yet delivered (delivered_at null). Cancelled/refused/delivered
    // assignments don't count, so a driver who just finished is free to take
    // the next one.
    if (status === 'accepted') {
      const { data: inflight, error: inflightErr } = await this.supabase
        .from('order_assignments')
        .select('id')
        .eq('driver_id', driverId)
        .eq('status', 'accepted')
        .is('delivered_at', null)
        .neq('id', assignmentId)
        .limit(1);
      if (inflightErr) throw inflightErr;
      if (inflight && inflight.length > 0) {
        throw new BadRequestException(
          'Tu as déjà une livraison en cours. Termine-la avant d\'en accepter une nouvelle.',
        );
      }
    }

    // Accepting collapses the old separate "picked up" step. The driver is
    // parked at the restaurant, so accepting the course IS taking the food: we
    // stamp picked_up_at now and advance the order to handed_to_livreur, which
    // fires the customer "Avec le livreur 🛵" push — no extra tap required.
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('order_assignments')
      .update({
        status,
        note: note?.trim() || null,
        responded_at: now,
        picked_up_at: status === 'accepted' ? now : null,
      })
      .eq('id', assignmentId)
      .select(ASSIGNMENT_SELECT)
      .single();
    if (error) throw error;

    if (status === 'accepted' && current.order_id) {
      // Best-effort: if the order isn't 'ready' yet (rare — admin normally
      // assigns ready orders), skip silently. markDelivered reconciles the
      // order status at the end, so the lifecycle still completes.
      try {
        await this.orders.advanceOrderStatus(
          current.order_id,
          'handed_to_livreur',
        );
      } catch {
        /* order not ready yet — no push now, reconciled at delivery */
      }
    }

    return data;
  }

  async markPickedUp(driverId: string, assignmentId: string) {
    const current = await this.getMyAssignment(driverId, assignmentId);
    if (current.status !== 'accepted') {
      throw new BadRequestException(
        'Tu dois d\'abord accepter la course.',
      );
    }
    if (current.picked_up_at) {
      throw new BadRequestException('Cette course est déjà ramassée.');
    }
    if (!current.order_id) {
      throw new BadRequestException('Commande liée introuvable.');
    }

    // Bumps orders.status: ready → handed_to_livreur. Throws if the order
    // isn't ready yet (e.g., still preparing). This also fires the customer
    // push ("Avec le livreur 🛵") via OrdersService.updateStatus().
    await this.orders.advanceOrderStatus(current.order_id, 'handed_to_livreur');

    const { data, error } = await this.supabase
      .from('order_assignments')
      .update({ picked_up_at: new Date().toISOString() })
      .eq('id', assignmentId)
      .select(ASSIGNMENT_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  async markDelivered(
    driverId: string,
    assignmentId: string,
    opts: { method: 'qr' | 'manual'; code?: string },
  ) {
    const current = await this.getMyAssignment(driverId, assignmentId);
    if (current.status !== 'accepted') {
      throw new BadRequestException(
        'Cette course n\'est pas en cours de livraison.',
      );
    }
    if (current.delivered_at) {
      throw new BadRequestException('Cette course est déjà livrée.');
    }
    if (!current.order_id) {
      throw new BadRequestException('Commande liée introuvable.');
    }

    // QR handoff: verify the scanned code against the order's secret. The
    // driver app never receives delivery_code (it's not in ASSIGNMENT_SELECT),
    // so a valid code proves the driver scanned the customer's screen. The
    // 'manual' method is the logged "confirmer sans QR" fallback.
    if (opts.method === 'qr') {
      const { data: ord } = await this.supabase
        .from('orders')
        .select('delivery_code')
        .eq('id', current.order_id)
        .maybeSingle();
      const expected = (ord?.delivery_code ?? '').toUpperCase();
      const provided = (opts.code ?? '').trim().toUpperCase();
      if (!expected || provided !== expected) {
        throw new BadRequestException('QR invalide — commande non livrée.');
      }
    }

    // Walk the order to the terminal 'picked_up' state. It's normally already
    // at handed_to_livreur (advanced when the driver accepted); the
    // ready→handed_to_livreur hop below is a no-op reconciliation for the edge
    // where the order only became ready after acceptance.
    try {
      await this.orders.advanceOrderStatus(
        current.order_id,
        'handed_to_livreur',
      );
    } catch {
      /* already past 'ready' — expected in the normal flow */
    }
    // Bumps orders.status: handed_to_livreur → picked_up (the terminal
    // "completed" state). Fires the customer push ("Bon app'! 💛 · Livraison
    // confirmée").
    await this.orders.advanceOrderStatus(current.order_id, 'picked_up');

    const { data, error } = await this.supabase
      .from('order_assignments')
      .update({
        delivered_at: new Date().toISOString(),
        delivered_method: opts.method,
      })
      .eq('id', assignmentId)
      .select(ASSIGNMENT_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Driver cancels a course already in their hands — typically a client
   * no-show, or a customer who's unreachable at the delivery address. Walks the
   * order to 'cancelled' (which stamps cancelled_at, broadcasts the kanban
   * event and pushes the customer "Commande annulée") and records the reason on
   * the assignment so the superadmin can see why it fell through.
   */
  async cancelByDriver(
    driverId: string,
    assignmentId: string,
    reason?: string,
  ) {
    const current = await this.getMyAssignment(driverId, assignmentId);
    if (current.status !== 'accepted') {
      throw new BadRequestException(
        'Seule une course en cours peut être annulée.',
      );
    }
    if (current.delivered_at) {
      throw new BadRequestException('Cette course est déjà livrée.');
    }
    if (!current.order_id) {
      throw new BadRequestException('Commande liée introuvable.');
    }

    // ready / handed_to_livreur → cancelled (allowed in the delivery
    // transition graph). Fires the customer "Commande annulée" push.
    await this.orders.advanceOrderStatus(current.order_id, 'cancelled');

    const { data, error } = await this.supabase
      .from('order_assignments')
      .update({
        status: 'cancelled',
        note: reason?.trim() || current.note || 'Annulée par le livreur',
      })
      .eq('id', assignmentId)
      .select(ASSIGNMENT_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  /** Driver files a delivery problem ticket. Does NOT mark the course delivered. */
  async reportProblem(
    driverId: string,
    assignmentId: string,
    category: string,
    description?: string,
  ) {
    const current = await this.getMyAssignment(driverId, assignmentId);
    const { data, error } = await this.supabase
      .from('delivery_tickets')
      .insert({
        order_id: current.order_id,
        assignment_id: assignmentId,
        reporter_id: driverId,
        reporter_role: 'driver',
        category,
        description: description?.trim() || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Earnings
  // ────────────────────────────────────────────────────────────────────────

  async earnings(driverId: string, period: 'today' | 'week' | 'month' = 'today') {
    const since = new Date();
    if (period === 'today') {
      since.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      since.setDate(since.getDate() - 7);
    } else {
      since.setMonth(since.getMonth() - 1);
    }

    const { data, error } = await this.supabase
      .from('order_assignments')
      .select(
        'id, delivered_at, orders:orders!order_assignments_order_id_fkey(delivery_fee_eur, total_eur)',
      )
      .eq('driver_id', driverId)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', since.toISOString());
    if (error) throw error;

    // supabase-js's generated types default joined rows to array shape even
    // when the FK is many-to-one. Cast through unknown so we can iterate the
    // single-object shape that the query actually returns at runtime.
    const rows = (data ?? []) as unknown as Array<{
      orders: { delivery_fee_eur: number | null; total_eur: number | null } | null;
    }>;
    const feeEUR = rows.reduce(
      (sum, r) => sum + Number(r.orders?.delivery_fee_eur ?? 0),
      0,
    );
    const grossEUR = rows.reduce(
      (sum, r) => sum + Number(r.orders?.total_eur ?? 0),
      0,
    );
    return {
      period,
      since: since.toISOString(),
      deliveries: rows.length,
      // Driver-attributable revenue: sum of delivery_fee_eur on delivered orders.
      // Commission/payout logic is out of scope for Phase 1 — surface raw fees
      // and let the client decide presentation.
      delivery_fees_eur: Number(feeEUR.toFixed(2)),
      // Gross order value, useful for the "you've moved €X today" headline.
      gross_eur: Number(grossEUR.toFixed(2)),
    };
  }
}
