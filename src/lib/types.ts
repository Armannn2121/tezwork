import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type Role = 'worker' | 'business';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  company_name: string | null;
  city: string;
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

export const CITIES = ['Алматы', 'Астана', 'Шымкент', 'Қарағанды'];

export const CATEGORIES: { id: string; label: string; icon: IconName }[] = [
  { id: 'retail', label: 'Сауда', icon: 'storefront-outline' },
  { id: 'warehouse', label: 'Қойма', icon: 'cube-outline' },
  { id: 'courier', label: 'Курьер', icon: 'bicycle-outline' },
  { id: 'cashier', label: 'Касса', icon: 'cash-outline' },
  { id: 'other', label: 'Басқа', icon: 'briefcase-outline' },
];

export const categoryOf = (id?: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: 'brand' | 'info' | 'neutral' | 'danger' }> = {
  confirmed: { label: 'Расталған', tone: 'brand' },
  checked_in: { label: 'Жұмыста', tone: 'info' },
  completed: { label: 'Аяқталды', tone: 'neutral' },
  cancelled: { label: 'Бас тартылды', tone: 'danger' },
};
