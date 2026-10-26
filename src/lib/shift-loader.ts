import { getShift, putApplications, putBizShifts, putOpenShifts } from './shift-cache';
import { supabase } from './supabase';
import { BizShift, MyApplication, OpenShift, ShiftView } from './types';

// Кэште жоқ ауысымды серверден табады (бетті жаңартқанда, сілтемемен ашқанда, хабарламадан кіргенде).
// Ауысым үш тізімнің біреуінде болады: жұмыс берушінің өз ауысымдары, жазылымдарым немесе ашық ауысымдар.
export async function loadShift(id: string, role?: 'worker' | 'business'): Promise<ShiftView | undefined> {
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
