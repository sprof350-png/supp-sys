export type Role = 'admin' | 'staff';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
}

export interface SupportService {
  id: string;
  name: string;
  originalPrice: number;
  subsidizedPrice: number;
  subsidizedLimit: number;
  priceAfterLimit: number;
  blockAfterLimit: boolean;
}

export interface Engineer {
  id: string;
  name: string;
  phone: string;
  membershipNumber: string;
}

export interface UsageRecord {
  id: string;
  engineerId: string;
  serviceId: string;
  count: number;
  date: string;
  totalPrice: number;
  isDeceasedFamily?: boolean;
}

export interface Database {
  users: User[];
  services: SupportService[];
  engineers: Engineer[];
  usage: UsageRecord[];
}
