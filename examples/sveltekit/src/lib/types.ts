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

export interface User {
  userId: string;
  name: string;
  role: "owner" | "chef" | "manager";
  createdAt: string;
}
