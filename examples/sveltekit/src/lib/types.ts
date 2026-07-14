export interface Menu {
  menuId: string;
  name: string;
  description: string;
  ownerUserId: string;
  createdAt: string;
}

export interface MenuItem {
  itemId: string;
  menuId: string;
  name: string;
  price: number;
  tags: string[];
}

export type OrderStatus = "open" | "preparing" | "served" | "cancelled";
export type OrderServiceType = "dine-in" | "takeout" | "delivery";
export type PaymentMethod = "cash" | "card" | "gift-card";
export type PaymentStatus = "pending" | "paid" | "refunded" | "voided";

export interface Customer {
  customerId: string;
  name: string;
  email: string;
  loyaltyTier: "standard" | "silver" | "gold";
  createdAt: string;
}

export interface RestaurantTable {
  tableId: string;
  name: string;
  section: "dining-room" | "patio" | "bar";
  seats: number;
  active: boolean;
}

export interface Payment {
  paymentId: string;
  orderId: string;
  amount: number;
  tip: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
}

export interface Shift {
  shiftId: string;
  userId: string;
  station: "floor" | "bar" | "kitchen" | "host" | "management";
  startsAt: string;
  endsAt: string;
}

export interface Reservation {
  reservationId: string;
  customerId: string;
  tableId: string;
  orderId: string | null;
  partySize: number;
  status: "booked" | "seated" | "completed" | "cancelled" | "no-show";
  reservedAt: string;
}

export interface OrderLine {
  lineId: string;
  orderId: string;
  menuId: string;
  itemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  orderId: string;
  tableName: string;
  tableId: string | null;
  table: RestaurantTable | null;
  customerId: string;
  customer: Customer;
  assignedUserId: string;
  serviceType: OrderServiceType;
  partySize: number;
  status: OrderStatus;
  lines: OrderLine[];
  payment: Payment | null;
  total: number;
  createdAt: string;
  closedAt: string | null;
}

export interface User {
  userId: string;
  name: string;
  role: "owner" | "chef" | "manager" | "server" | "host";
  createdAt: string;
}
