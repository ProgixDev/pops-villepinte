import type { OrderStatus } from "@/types";

export const ORDER_STATUS = {
  RECEIVED: "received",
  PREPARING: "preparing",
  READY: "ready",
  PICKED_UP: "picked_up",
  CANCELLED: "cancelled",
} as const satisfies Record<string, OrderStatus>;

/** Statuses where the order is still progressing through the kitchen. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
];

/** Statuses with no further transitions. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.CANCELLED,
];

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status);
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}
