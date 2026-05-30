import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Injectable()
export class AdminSupportService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
  ) {}

  async listTickets(status?: 'open' | 'resolved') {
    let qb = this.supabase
      .from('delivery_tickets')
      .select(
        '*, reporter:profiles!delivery_tickets_reporter_id_fkey(name, phone, role)',
      )
      .order('created_at', { ascending: false });
    if (status) qb = qb.eq('status', status);
    const { data, error } = await qb;
    if (error) throw error;
    return data ?? [];
  }

  async updateTicket(id: string, dto: UpdateTicketDto) {
    const patch: Record<string, unknown> = {};
    if (dto.status !== undefined) {
      patch.status = dto.status;
      patch.resolved_at =
        dto.status === 'resolved' ? new Date().toISOString() : null;
    }
    if (dto.admin_notes !== undefined) {
      patch.admin_notes = dto.admin_notes.trim() || null;
    }
    const { data, error } = await this.supabase
      .from('delivery_tickets')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listDriverRatings(driverId?: string) {
    let qb = this.supabase
      .from('driver_ratings')
      .select(
        '*, driver:profiles!driver_ratings_driver_id_fkey(name, phone)',
      )
      .order('created_at', { ascending: false });
    if (driverId) qb = qb.eq('driver_id', driverId);
    const { data, error } = await qb;
    if (error) throw error;
    return data ?? [];
  }
}
