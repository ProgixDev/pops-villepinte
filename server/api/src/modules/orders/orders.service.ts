import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import {
  recalculateLineUnitPrice,
  recalculateLineTotal,
  recalculateOrderTotal,
} from '../../common/utils/price';
import {
  DEFAULT_DELIVERY_BASE_FEE_EUR,
  DEFAULT_DELIVERY_PER_KM_EUR,
  computeDeliveryFee,
  distanceFromStoreKm,
} from '../../common/utils/delivery';
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  ADMIN_CANCELLABLE_STATUSES,
  DEFAULT_PREP_BUFFER_MINUTES,
  transitionsFor,
} from '../../shared/constants';
import { OrderStatus, PickupMode } from '../../shared/types';
import { CreateOrderDto } from './dto/create-order.dto';
import { CustomerOrdersQueryDto, AdminOrdersQueryDto } from './dto/orders-query.dto';
import { OrdersGateway } from './orders.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    private readonly gateway: OrdersGateway,
    private readonly notifications: NotificationsService,
  ) {}

  // Human-friendly copy for the customer's push + history rows.
  private statusPushCopy(
    status: OrderStatus,
    pickupMode: 'pickup' | 'delivery' | null | undefined,
  ): { title: string; body: string } | null {
    const isDelivery = pickupMode === 'delivery';
    switch (status) {
      case 'preparing':
        return {
          title: 'On allume les plaques 🔥',
          body: 'Ta commande est en cours de préparation.',
        };
      case 'ready':
        return {
          title: isDelivery ? 'Prête à partir 🛵' : "C'est prêt !",
          body: isDelivery
            ? "Le livreur arrive pour récupérer ton sac."
            : "Direction le comptoir pour la récupérer.",
        };
      case 'handed_to_livreur':
        return {
          title: 'Avec le livreur 🛵',
          body: 'Il est en route — sois dispo à ton adresse.',
        };
      case 'picked_up':
        return {
          title: 'Bon app\'! 💛',
          body: isDelivery ? 'Livraison confirmée.' : 'Commande remise.',
        };
      case 'cancelled':
        return {
          title: 'Commande annulée',
          body: 'Si tu as une question, contacte-nous.',
        };
      default:
        return null;
    }
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    // 0. Resolve pickup vs delivery + fee. We do this up front so any user
    // error surfaces before we waste round-trips fetching the catalogue.
    const pickupMode: 'pickup' | 'delivery' = dto.pickupMode ?? 'pickup';
    let deliveryFee = 0;
    let deliveryAddress: string | null = null;
    let deliveryLat: number | null = null;
    let deliveryLng: number | null = null;

    if (pickupMode === 'delivery') {
      if (
        !dto.deliveryAddress ||
        dto.deliveryLat === undefined ||
        dto.deliveryLng === undefined
      ) {
        throw new BadRequestException(
          'Adresse de livraison incomplète — précise rue, latitude et longitude.',
        );
      }
      const km = distanceFromStoreKm(dto.deliveryLat, dto.deliveryLng);

      // Pricing is configured per shop. Read the live values so the admin
      // panel can change them without a redeploy.
      const { data: settings } = await this.supabase
        .from('shop_settings')
        .select('delivery_base_fee_eur, delivery_per_km_eur')
        .eq('id', 1)
        .maybeSingle();
      const baseFee = settings?.delivery_base_fee_eur
        ? Number(settings.delivery_base_fee_eur)
        : DEFAULT_DELIVERY_BASE_FEE_EUR;
      const perKm = settings?.delivery_per_km_eur
        ? Number(settings.delivery_per_km_eur)
        : DEFAULT_DELIVERY_PER_KM_EUR;
      deliveryFee = computeDeliveryFee(km, baseFee, perKm);
      deliveryAddress = dto.deliveryAddress;
      deliveryLat = dto.deliveryLat;
      deliveryLng = dto.deliveryLng;
    }

    // 1. Split items by kind and collect referenced ids
    const productItems = dto.items.filter((i) => !i.accompagnementId);
    const accItems = dto.items.filter((i) => i.accompagnementId);

    for (const item of dto.items) {
      const hasProduct = Boolean(item.productId);
      const hasAcc = Boolean(item.accompagnementId);
      if (hasProduct === hasAcc) {
        throw new BadRequestException(
          'Each cart item must reference either productId or accompagnementId',
        );
      }
    }

    const productIds = [
      ...new Set(productItems.map((i) => i.productId!)),
    ];
    const accompagnementIds = [
      ...new Set(accItems.map((i) => i.accompagnementId!)),
    ];
    const variantIds = [
      ...new Set(
        productItems.filter((i) => i.variantId).map((i) => i.variantId!),
      ),
    ];
    const supplementIds = [
      ...new Set(productItems.flatMap((i) => i.supplements ?? [])),
    ];

    // 2. Fetch all referenced entities
    const [productsRes, accRes, variantsRes, supplementsRes, junctionRes] =
      await Promise.all([
        productIds.length > 0
          ? this.supabase.from('products').select('*').in('id', productIds)
          : { data: [] as any[], error: null },
        accompagnementIds.length > 0
          ? this.supabase
              .from('accompagnements')
              .select('*')
              .in('id', accompagnementIds)
          : { data: [] as any[], error: null },
        variantIds.length > 0
          ? this.supabase
              .from('product_variants')
              .select('*')
              .in('id', variantIds)
          : { data: [], error: null },
        supplementIds.length > 0
          ? this.supabase
              .from('supplements')
              .select('*')
              .in('id', supplementIds)
          : { data: [], error: null },
        supplementIds.length > 0
          ? this.supabase
              .from('product_supplements')
              .select('*')
              .in('product_id', productIds)
              .in('supplement_id', supplementIds)
          : { data: [], error: null },
      ]);

    if (productsRes.error) throw productsRes.error;
    if (accRes.error) throw accRes.error;
    if (variantsRes.error) throw variantsRes.error;
    if (supplementsRes.error) throw supplementsRes.error;
    if (junctionRes.error) throw junctionRes.error;

    const productsMap = new Map(productsRes.data!.map((p) => [p.id, p]));
    const accMap = new Map(accRes.data!.map((a) => [a.id, a]));
    const variantsMap = new Map(variantsRes.data!.map((v) => [v.id, v]));
    const supplementsMap = new Map(supplementsRes.data!.map((s) => [s.id, s]));
    const junctionSet = new Set(
      junctionRes.data!.map(
        (j) => `${j.product_id}:${j.supplement_id}`,
      ),
    );

    // 3. Validate and calculate prices
    let maxPrepTime = 0;
    const orderItems: Array<{
      product_id: string | null;
      accompagnement_id: string | null;
      variant_id: string | null;
      quantity: number;
      unit_price_eur: number;
      line_total_eur: number;
      supplements: Array<{ id: string; name: string; priceEUR: number }>;
      notes: string | null;
    }> = [];

    for (const item of dto.items) {
      if (item.accompagnementId) {
        const acc = accMap.get(item.accompagnementId);
        if (!acc) {
          throw new BadRequestException(
            `Accompagnement ${item.accompagnementId} not found`,
          );
        }
        if (!acc.is_active) {
          throw new BadRequestException(
            `Accompagnement "${acc.name}" is not available`,
          );
        }
        const unitPrice = Number(acc.price_eur);
        orderItems.push({
          product_id: null,
          accompagnement_id: acc.id,
          variant_id: null,
          quantity: item.quantity,
          unit_price_eur: unitPrice,
          line_total_eur: unitPrice * item.quantity,
          supplements: [],
          notes: item.notes ?? null,
        });
        continue;
      }

      const product = productsMap.get(item.productId!);
      if (!product) {
        throw new BadRequestException(
          `Product ${item.productId} not found`,
        );
      }
      if (!product.is_available) {
        throw new BadRequestException(
          `Product "${product.name}" is not available`,
        );
      }

      let variant = null;
      if (item.variantId) {
        variant = variantsMap.get(item.variantId);
        if (!variant || variant.product_id !== item.productId) {
          throw new BadRequestException(
            `Variant ${item.variantId} does not belong to product "${product.name}"`,
          );
        }
      }

      const itemSupplements: Array<{
        id: string;
        name: string;
        priceEUR: number;
      }> = [];
      for (const supId of item.supplements ?? []) {
        const supplement = supplementsMap.get(supId);
        if (!supplement) {
          throw new BadRequestException(`Supplement ${supId} not found`);
        }
        if (!junctionSet.has(`${item.productId}:${supId}`)) {
          throw new BadRequestException(
            `Supplement "${supplement.name}" is not available for product "${product.name}"`,
          );
        }
        itemSupplements.push({
          id: supplement.id,
          name: supplement.name,
          priceEUR: supplement.price_eur,
        });
      }

      const unitPrice = recalculateLineUnitPrice(
        product,
        variant,
        itemSupplements.map((s) => ({ price_eur: s.priceEUR })),
      );
      const lineTotal = recalculateLineTotal(
        product,
        variant,
        itemSupplements.map((s) => ({ price_eur: s.priceEUR })),
        item.quantity,
      );

      orderItems.push({
        product_id: item.productId!,
        accompagnement_id: null,
        variant_id: item.variantId ?? null,
        quantity: item.quantity,
        unit_price_eur: unitPrice,
        line_total_eur: lineTotal,
        supplements: itemSupplements,
        notes: item.notes ?? null,
      });

      if (product.prep_time_minutes > maxPrepTime) {
        maxPrepTime = product.prep_time_minutes;
      }
    }

    const itemsTotal = recalculateOrderTotal(
      orderItems.map((i) => ({
        unitPriceEur: i.unit_price_eur,
        quantity: i.quantity,
      })),
    );
    const totalEur = itemsTotal + deliveryFee;

    // 4. Calculate estimated ready time
    const estimatedReadyAt = new Date(
      Date.now() + (maxPrepTime + DEFAULT_PREP_BUFFER_MINUTES) * 60 * 1000,
    ).toISOString();

    // 5. Insert order
    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .insert({
        user_id: userId,
        customer_name: dto.customerName,
        total_eur: totalEur,
        status: 'received' as OrderStatus,
        estimated_ready_at: estimatedReadyAt,
        notes: dto.notes ?? null,
        pickup_mode: pickupMode,
        delivery_address: deliveryAddress,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        delivery_fee_eur: deliveryFee,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 6. Insert order items
    const { error: itemsError } = await this.supabase
      .from('order_items')
      .insert(
        orderItems.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          accompagnement_id: item.accompagnement_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price_eur: item.unit_price_eur,
          line_total_eur: item.line_total_eur,
          supplements: item.supplements,
          notes: item.notes,
        })),
      );

    if (itemsError) throw itemsError;

    // 7. Fetch complete order with items
    const fullOrder = await this.getOrderById(order.id);

    // 8. Emit SSE event
    this.gateway.emit({ type: 'order:created', data: fullOrder });

    return fullOrder;
  }

  async getCustomerOrders(userId: string, query: CustomerOrdersQueryDto) {
    let qb = this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId);

    if (query.filter === 'active') {
      qb = qb.in('status', ['received', 'preparing', 'ready']);
    } else if (query.filter === 'past') {
      qb = qb.in('status', ['picked_up', 'cancelled']);
    }

    qb = qb
      .order('created_at', { ascending: false })
      .range(query.offset, query.offset + (query.limit ?? 20) - 1);

    const { data, error } = await qb;
    if (error) throw error;
    return data;
  }

  async getOrderById(orderId: string) {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (error) throw new NotFoundException('Order not found');
    return data;
  }

  async getCustomerOrderById(userId: string, orderId: string) {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();

    if (error) throw new NotFoundException('Order not found');
    return data;
  }

  async cancelCustomerOrder(userId: string, orderId: string) {
    const order = await this.getCustomerOrderById(userId, orderId);

    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel order in "${order.status}" status`,
      );
    }

    return this.updateStatus(orderId, 'cancelled');
  }

  // Admin methods
  async getAdminOrders(query: AdminOrdersQueryDto) {
    let qb = this.supabase
      .from('orders')
      .select('*, order_items(*)');

    if (query.status) {
      qb = qb.eq('status', query.status);
    }
    if (query.date_from) {
      qb = qb.gte('created_at', query.date_from);
    }
    if (query.date_to) {
      qb = qb.lte('created_at', query.date_to);
    }

    qb = qb
      .order('created_at', { ascending: false })
      .range(query.offset, query.offset + (query.limit ?? 20) - 1);

    const { data, error } = await qb;
    if (error) throw error;
    return data;
  }

  async advanceOrderStatus(orderId: string, newStatus: OrderStatus) {
    const order = await this.getOrderById(orderId);
    const transitions = transitionsFor(order.pickup_mode as PickupMode | null);
    const allowed = transitions[order.status as OrderStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${order.status}" to "${newStatus}"`,
      );
    }

    return this.updateStatus(orderId, newStatus);
  }

  /**
   * Customer self-confirms reception of the order. For pickup this is the
   * moment the customer takes the bag at the counter; for delivery it is the
   * moment the courier hands them the food.
   */
  async confirmCustomerPickedUp(userId: string, orderId: string) {
    const order = await this.getCustomerOrderById(userId, orderId);
    const transitions = transitionsFor(order.pickup_mode as PickupMode | null);
    const allowed = transitions[order.status as OrderStatus] ?? [];

    if (!allowed.includes('picked_up')) {
      throw new BadRequestException(
        order.pickup_mode === 'delivery'
          ? 'La commande n\'est pas encore en main du livreur.'
          : 'La commande n\'est pas encore prête.',
      );
    }

    return this.updateStatus(orderId, 'picked_up');
  }

  async adminCancelOrder(orderId: string) {
    const order = await this.getOrderById(orderId);

    if (!ADMIN_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel order in "${order.status}" status`,
      );
    }

    return this.updateStatus(orderId, 'cancelled');
  }

  private async updateStatus(orderId: string, status: OrderStatus) {
    const updateData: Record<string, unknown> = { status };
    if (status === 'picked_up') {
      updateData.picked_up_at = new Date().toISOString();
    }
    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select('*, order_items(*)')
      .single();

    if (error) throw error;

    const eventType =
      status === 'cancelled' ? 'order:cancelled' : 'order:status_changed';
    this.gateway.emit({ type: eventType, data });

    // Best-effort push + history row to the customer. We never block the
    // status update on a delivery hiccup with Expo / device tokens.
    const copy = this.statusPushCopy(
      status,
      data.pickup_mode as 'pickup' | 'delivery' | undefined,
    );
    if (copy && data.user_id) {
      void this.notifications
        .notify(
          { kind: 'user', userIds: [data.user_id] },
          {
            title: copy.title,
            body: copy.body,
            notificationKind: 'order',
            orderId: data.id,
            data: { status },
          },
        )
        .catch(() => {
          /* push is best-effort — failure must not roll back the status update */
        });
    }

    return data;
  }
}
