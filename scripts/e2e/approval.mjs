// Өтінімді растау ағынын екі демо аккаунтпен тексереді:
// жұмыс беруші ауысым ашады → жұмысшы өтінім береді (pending) → жұмыс беруші қабылдайды → орын толып, ауысым лентадан жоғалады.
// Іске қосу: node scripts/e2e/approval.mjs        (соңында тест ауысымы жабылады)
//            E2E_KEEP=1 node scripts/e2e/approval.mjs  (ауысым ашық қалады, өтінім pending күйінде — UI-да қолмен тексеру үшін)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const config = readFileSync(join(root, 'src/lib/config.ts'), 'utf8');
const otpFor = (phone) => config.match(new RegExp(`'\\${phone}':\\s*'(\\d+)'`))?.[1];
const keep = process.env.E2E_KEEP === '1';

async function login(phone) {
  const c = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  const { data, error } = await c.auth.verifyOtp({ phone, token: otpFor(phone), type: 'sms' });
  if (error) throw error;
  return { c, id: data.user.id };
}

let failed = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` (${extra})` : ''}`);
  if (!ok) failed++;
}
const rpc = async (c, fn, args) => {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};

const biz = await login('+77779876543');
const worker = await login('+77771234567');

const start = new Date(Date.now() + 26 * 3600e3);
start.setMinutes(0, 0, 0);
const { data: shift, error } = await biz.c.from('shifts').insert({
  business_id: biz.id, title: 'E2E: растау тесті', category: 'other', city: 'Алматы', address: 'Тест көшесі 1',
  starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 4 * 3600e3).toISOString(), pay_kzt: 6000, spots: 1,
}).select('id').single();
if (error) throw error;
console.log('ауысым:', shift.id);

try {
  const feed0 = await rpc(worker.c, 'list_open_shifts', { p_city: null });
  check('жаңа ауысым лентада', feed0.some((s) => s.id === shift.id));

  await rpc(worker.c, 'apply_to_shift', { p_shift_id: shift.id });
  const [w1] = await rpc(worker.c, 'get_shift', { p_id: shift.id });
  check('өтінім pending', w1.application_status === 'pending', w1.application_status);
  check('pending кезінде орын алынбайды', w1.spots_left === 1, `spots_left=${w1.spots_left}`);
  check('pending кезінде жұмыс беруші нөмірі жасырын', !w1.business_phone);

  const mine = (await rpc(biz.c, 'my_business_shifts')).find((s) => s.id === shift.id);
  check('жұмыс беруші тізімінде pending=1', mine?.pending === 1 && mine?.taken === 0, `taken=${mine?.taken} pending=${mine?.pending}`);
  const [ap] = await rpc(biz.c, 'shift_applicants', { p_shift_id: shift.id });
  check('жұмыс беруші жұмысшы нөмірін бірден көреді', ap?.status === 'pending' && !!ap?.worker_phone);

  const { error: selfErr } = await worker.c.rpc('decide_application', { p_application_id: ap.application_id, p_accept: true });
  check('жұмысшы өзін өзі қабылдай алмайды', !!selfErr);

  if (keep) {
    console.log('\nE2E_KEEP=1: ауысым ашық, өтінім pending — қосымшада «Қабылдау» басып тексеріңіз.');
  } else {
    await rpc(biz.c, 'decide_application', { p_application_id: ap.application_id, p_accept: true });
    const [w2] = await rpc(worker.c, 'get_shift', { p_id: shift.id });
    check('қабылданғаннан кейін confirmed', w2.application_status === 'confirmed', w2.application_status);
    check('қабылданғаннан кейін нөмір ашылды', !!w2.business_phone);
    check('орын толды', w2.spots_left === 0);

    const { data: other } = await biz.c.rpc('list_open_shifts', { p_city: null });
    check('толған ауысым басқаларға лентада көрінбейді', !(other ?? []).some((s) => s.id === shift.id));
    const feed2 = await rpc(worker.c, 'list_open_shifts', { p_city: null });
    check('қабылданған жұмысшы өз ауысымын лентада көреді', feed2.some((s) => s.id === shift.id && s.applied));

    const { error: earlyErr } = await biz.c.rpc('set_application_status', { p_application_id: ap.application_id, p_status: 'completed' });
    check('басталмаған ауысымды аяқтауға болмайды', !!earlyErr);
  }
} finally {
  if (!keep) {
    await biz.c.from('shifts').update({ status: 'cancelled' }).eq('id', shift.id);
    console.log('тест ауысымы жабылды');
  }
  await biz.c.auth.signOut({ scope: 'local' });
  await worker.c.auth.signOut({ scope: 'local' });
}

console.log(failed ? `\n${failed} тексеріс өтпеді` : '\nБарлық тексеріс өтті');
process.exit(failed ? 1 : 0);
