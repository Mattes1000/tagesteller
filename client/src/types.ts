export interface Menu {
  id: number;
  name: string;
  description: string;
  price: number;
  active: number;
  dates: string;
  max_quantity?: number | null;
  remaining_quantity?: number | null;
  menuDays?: { available_date: string; max_quantity: number | null }[];
  created_at?: string;
}

export interface CartItem {
  menu: Menu;
  quantity: number;
}

export interface User {
  id: number;
  firstname: string;
  lastname: string;
  username?: string;
  role: "admin" | "manager" | "user";
  qr_token: string;
  created_at?: string;
}

export interface LoginResponse extends User {
  token: string;
}

export interface Order {
  id: number;
  user_id: number | null;
  user_fullname: string | null;
  user_role: string | null;
  customer_name: string;
  order_date: string;
  total: number;
  remarks?: string;
  items: string;
  created_at: string;
}
