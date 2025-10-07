export interface Job {
  id: number;
  title: string;
  description: string;
  customer_name: string;
  vehicle_info: string;
  status: 'todo' | 'in_progress' | 'completed';
  assigned_to: number | null;
  assigned_to_name: string | null;
  assigned_employees?: { id: number; name: string; assigned_at: string }[];
  created_by: number;
  created_by_name: string;
  estimated_hours: number;
  actual_hours: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee';
}

export interface Event {
  id: number;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  company?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}