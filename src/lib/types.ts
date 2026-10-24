import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { t, TKey } from './i18n';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type Role = 'worker' | 'business';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  company_name: string | null;
  company_bin?: string | null;
  city: string;
  terms_accepted_at?: string | null;
};

export type OpenShift = {
  id: string; title: string; category: string; city: string; address: string | null;
  starts_at: string; ends_at: string; pay_kzt: number; spots: number; spots_left: number;
  company_name: string | null; applied: boolean;
};

export type ApplicationStatus = 'confirmed' | 'checked_in' | 'completed' | 'cancelled';

export type MyApplication = {
  application_id: string; status: ApplicationStatus; shift_id: string; title: string; city: string;
  address: string | null; starts_at: string; ends_at: string; pay_kzt: number; company_name: string | null;
};

export type BizShift = {
  id: string; title: string; city: string; address: string | null; starts_at: string; ends_at: string;
  pay_kzt: number; spots: number; status: string; taken: number; category?: string;
};

export type Applicant = { application_id: string; full_name: string; status: ApplicationStatus };

// Барлық тізімдегі ауысымдардың ортақ көрінісі (толық бетке арналған)
export type ShiftView = {
  id: string; title: string; city: string; address: string | null;
  starts_at: string; ends_at: string; pay_kzt: number;
  category?: string; company_name?: string | null;
  spots?: number; spots_left?: number; taken?: number;
  status?: string; applied?: boolean;
  application_id?: string; application_status?: ApplicationStatus;
};

const CATEGORY_DEFS: { id: string; icon: IconName }[] = [
  { id: 'retail', icon: 'storefront-outline' },
  { id: 'warehouse', icon: 'cube-outline' },
  { id: 'courier', icon: 'bicycle-outline' },
  { id: 'cashier', icon: 'cash-outline' },
  { id: 'horeca', icon: 'restaurant-outline' },
  { id: 'cleaning', icon: 'sparkles-outline' },
  { id: 'events', icon: 'musical-notes-outline' },
  { id: 'other', icon: 'briefcase-outline' },
];

// Атаулар ағымдағы тілде — сондықтан функция
export const categories = () => CATEGORY_DEFS.map((c) => ({ ...c, label: t(`cat.${c.id}` as TKey) }));

export const categoryOf = (id?: string) => {
  const all = categories();
  return all.find((c) => c.id === id) ?? all[all.length - 1];
};

export const STATUS_TONE: Record<ApplicationStatus, 'brand' | 'info' | 'neutral' | 'danger'> = {
  confirmed: 'brand', checked_in: 'info', completed: 'neutral', cancelled: 'danger',
};

export const statusLabel = (s: ApplicationStatus) => t(`status.${s}` as TKey);
