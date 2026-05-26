import type { DriverAssignment } from "@/lib/api";
import type { Delivery, DeliveryAddress, DeliveryStatus } from "@/types/driver";

// Pickup is always POP'S Villepinte. The store address rarely changes; if it
// ever does, surface it through shop_settings and read here.
const POPS_VILLEPINTE_PICKUP: DeliveryAddress = {
  label: "POP'S Villepinte",
  line1: "ZAC du Sausset",
  city: "Villepinte",
  postalCode: "93420",
  coordinates: [2.5392, 48.9695],
};

function shortCodeFromOrderId(orderId: string): string {
  // Backend uses prefixed strings like "ord_2024…" — take the last 4 chars,
  // uppercased, prefixed PV- so the driver has a 6-char visual handle.
  const tail = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return `PV-${tail || "0000"}`;
}

function deriveStatus(a: DriverAssignment): DeliveryStatus {
  if (a.status === "refused" || a.status === "cancelled") return "cancelled";
  if (a.status === "pending") return "assigned";
  // accepted
  if (a.delivered_at) return "delivered";
  if (a.picked_up_at) return "picked_up";
  return "accepted";
}

export function mapAssignmentToDelivery(a: DriverAssignment): Delivery {
  const o = a.orders;
  const dropoff: DeliveryAddress = {
    label: o?.customer_name ?? "Client",
    line1: o?.delivery_address ?? "Adresse à confirmer",
    city: "",
    postalCode: "",
    coordinates: [
      Number(o?.delivery_lng ?? 0),
      Number(o?.delivery_lat ?? 0),
    ] as [number, number],
  };

  return {
    id: a.id,
    orderId: a.order_id,
    shortCode: shortCodeFromOrderId(a.order_id),
    status: deriveStatus(a),
    pickup: POPS_VILLEPINTE_PICKUP,
    dropoff,
    customerName: o?.customer_name ?? "",
    customerPhone: o?.customer_phone ?? "",
    // We don't fetch order_items in the driver assignments select; surface a
    // single placeholder "items" entry so the UI count is non-zero. A future
    // join can replace this.
    items: [{ name: "Commande", quantity: 1 }],
    totalEUR: Number(o?.total_eur ?? 0),
    driverPayoutEUR: Number(o?.delivery_fee_eur ?? 0),
    // Unknown without a routing call — UI hides these when 0.
    distanceMeters: 0,
    estimatedDurationMinutes: 0,
    createdAt: a.assigned_at,
    acceptedAt: a.responded_at ?? undefined,
    pickedUpAt: a.picked_up_at ?? undefined,
    deliveredAt: a.delivered_at ?? undefined,
  };
}
