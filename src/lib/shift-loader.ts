import { getShift, putApplications, putBizShifts, putOpenShifts, putShift } from './shift-cache';
import { supabase } from './supabase';
import { BizShift, MyApplication, OpenShift, ShiftView } from './types';

// get_shift миграциясы әлі жіберілмесе — бір рет байқап, бұрынғы жолмен жүреміз
let hasGetShift = true;

// Ауысымның толық көрінісін серверден жүктейді (бетті ашқанда, жазылғаннан кейін, сілтемемен кіргенде).
// get_shift — бір шағын сұраныс; бұрын бұл үшін бүкіл тізімдер (барлық қалалардың ауысымдары) жүктелетін.
export async function loadShift(id: string, role?: 'worker' | 'business'): Promise<ShiftView | undefined> {
  if (hasGetShift) {
    const { data, error } = await supabase.rpc('get_shift', { p_id: id });
    if (!error) {
      const row = (data as ShiftView[] | null)?.[0];
      if (!row) return undefined;
      putShift(row);
      return getShift(id);
    }
    if (error.code !== 'PGRST202') throw new Error(error.message);
    hasGetShift = false;
  }
  return loadFromLists(id, role);
}

async function loadFromLists(id: string, role?: 'worker' | 'business') {
  if (role === 'business') {
    const { data } = await supabase.rpc('my_business_shifts');
    if (data) putBizShifts(data as BizShift[]);
    return getShift(id);
  }
  const [apps, open] = await Promise.all([
    supabase.rpc('my_applications'),
    supabase.rpc('list_open_shifts', { p_city: null }),
  ]);
  if (open.data) putOpenShifts(open.data as OpenShift[]);
  if (apps.data) putApplications(apps.data as MyApplication[]);
  return getShift(id);
}
