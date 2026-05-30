import { OrderStatus, PickupMode } from './types';

// Transitions branch on pickup_mode so the kanban (admin) and customer screens
// reflect the right lifecycle:
//   pickup    : received → preparing → ready → picked_up
//   delivery  : received → preparing → ready → handed_to_livreur → picked_up
export const ORDER_STATUS_TRANSITIONS_PICKUP: Record<OrderStatus, OrderStatus[]> = {
  received: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['picked_up'],
  handed_to_livreur: [],
  picked_up: [],
  cancelled: [],
};

export const ORDER_STATUS_TRANSITIONS_DELIVERY: Record<
  OrderStatus,
  OrderStatus[]
> = {
  received: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['handed_to_livreur', 'cancelled'],
  // The driver can cancel a course already in their hands when the client is a
  // no-show (or unreachable at the delivery address).
  handed_to_livreur: ['picked_up', 'cancelled'],
  picked_up: [],
  cancelled: [],
};

export function transitionsFor(mode: PickupMode | null | undefined) {
  return mode === 'delivery'
    ? ORDER_STATUS_TRANSITIONS_DELIVERY
    : ORDER_STATUS_TRANSITIONS_PICKUP;
}

export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = ['received'];
export const ADMIN_CANCELLABLE_STATUSES: OrderStatus[] = [
  'received',
  'preparing',
];

export const MAX_ITEMS_PER_ORDER = 50;
export const DEFAULT_PREP_BUFFER_MINUTES = 2;
