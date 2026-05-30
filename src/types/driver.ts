export type LngLat = readonly [number, number]; // [lng, lat]

// UI-friendly status, derived from server assignment.status + picked_up_at +
// delivered_at via mapAssignment().
export type DeliveryStatus =
  | "assigned" // assigned to driver, not yet accepted
  | "accepted" // driver accepted (= took the food, parked at the restaurant) and is en route to the customer
  | "delivered"
  | "cancelled";

export type DeliveryAddress = {
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  coordinates: LngLat;
  notes?: string;
};

export type DeliveryItem = {
  name: string;
  quantity: number;
};

export type Delivery = {
  id: string; // assignment id
  orderId: string;
  shortCode: string;
  status: DeliveryStatus;
  pickup: DeliveryAddress;
  dropoff: DeliveryAddress;
  customerName: string;
  customerPhone: string;
  items: DeliveryItem[];
  totalEUR: number;
  driverPayoutEUR: number;
  // Real distance/duration requires a routing call; we surface 0 when unknown
  // and the UI hides those fields in that case.
  distanceMeters: number;
  estimatedDurationMinutes: number;
  createdAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
};

export type DriverVehicle = "scooter" | "bike" | "car";

export type DriverProfileView = {
  name: string;
  phone: string;
  vehicle: DriverVehicle;
  licensePlate?: string;
  // Server-side counters aren't on profiles yet; the UI shows placeholders
  // until we wire an aggregate query. Keeping the field here so the existing
  // Profile screen renders without crashing.
  rating: number;
  deliveryCount: number;
};
