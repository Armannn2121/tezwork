import { BizShift, MyApplication, OpenShift, ShiftView } from './types';

// Тізімдерден жүктелген ауысымдар — толық бетті бірден көрсету үшін
const cache = new Map<string, ShiftView>();

export const getShift = (id: string) => cache.get(id);

export function patchShift(id: string, patch: Partial<ShiftView>) {
  const cur = cache.get(id);
  if (cur) cache.set(id, { ...cur, ...patch });
}

export function putOpenShifts(items: OpenShift[]) {
  for (const s of items) cache.set(s.id, { ...s });
}

export function putBizShifts(items: BizShift[]) {
  for (const s of items) cache.set(s.id, { ...s });
}

export function putApplications(items: MyApplication[]) {
  for (const a of items) {
    cache.set(a.shift_id, {
      ...cache.get(a.shift_id),
      id: a.shift_id, title: a.title, city: a.city, address: a.address,
      starts_at: a.starts_at, ends_at: a.ends_at, pay_kzt: a.pay_kzt, company_name: a.company_name,
      applied: a.status !== 'cancelled', application_id: a.application_id, application_status: a.status,
    });
  }
}
