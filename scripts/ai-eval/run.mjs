// AI ауысым көмекшісінің дәлдігін өлшейді: cases.json → ai-shift-draft → өріс бойынша салыстыру.
// Іске қосу: node scripts/ai-eval/run.mjs
// Демо жұмыс берушінің тест нөмірімен кіреді (src/lib/config.ts → DEMO_OTPS); нәтиже docs/ai-eval.md-ге жазылады.
// ⚠ Әр іске қосу Claude API-ге ~40 сұраныс жібереді (ақылы).

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const phone = process.env.EVAL_PHONE ?? '+77779876543';
const otp = process.env.EVAL_OTP
  ?? readFileSync(join(root, 'src/lib/config.ts'), 'utf8').match(new RegExp(`'\\${phone}':\\s*'(\\d+)'`))?.[1];
if (!otp) throw new Error(`${phone} үшін тест коды табылмады`);

const { today, cases: allCases } = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8'));
// EVAL_ONLY=kk01,ru01 — тек осы жағдайлар (тексеру үшін; есеп файлы жазылмайды)
const only = process.env.EVAL_ONLY?.split(',');
const cases = only ? allCases.filter((c) => only.includes(c.id)) : allCases;
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
const { error: authError } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
if (authError) throw authError;

const norm = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').trim();
const includesAny = (value, options) => options.some((o) => norm(value).includes(norm(o)));

const FIELDS = ['title', 'category', 'city', 'address', 'date', 'start', 'end', 'pay_mode', 'pay', 'spots'];
function grade(draft, expect) {
  const out = {};
  for (const f of FIELDS) {
    if (!(f in expect)) continue;
    const e = expect[f];
    out[f] = Array.isArray(e) ? includesAny(draft[f], e) : draft[f] === e;
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runCase(c, attempt = 1) {
  const t0 = Date.now();
  const { data, error } = await supabase.functions.invoke('ai-shift-draft', { body: { text: c.text, today } });
  const ms = Date.now() - t0;
  if (error) {
    const body = await error.context?.json?.().catch(() => null);
    // Тегін тарифтің минуттық шегі — күтіп, қайталаймыз
    if (body?.error === 'busy' && attempt < 4) { await sleep(20_000 * attempt); return runCase(c, attempt + 1); }
    return { id: c.id, lang: c.lang, ms, error: [body?.error ?? error.message, body?.reason].filter(Boolean).join(': ') };
  }
  return { id: c.id, lang: c.lang, ms, draft: data.draft, model: data.model, grades: grade(data.draft, c.expect) };
}

// EVAL_RESUME=1 — алдыңғы іске қосудың сәтті нәтижелерін қалдырып, тек қатемен біткендерді қайта жібереміз
// (тегін тарифтің квотасы бітсе, келесі күні жалғастыру үшін)
const prev = process.env.EVAL_RESUME ? JSON.parse(readFileSync(join(here, 'last-run.json'), 'utf8')) : [];
const kept = prev.filter((r) => !r.error && cases.some((c) => c.id === r.id));

// Бір уақыттағы сұраныс саны (тегін тарифте аз қойыңыз: EVAL_CONCURRENCY=2)
const results = [...kept];
const queue = cases.filter((c) => !kept.some((r) => r.id === c.id));
if (kept.length) console.log(`Алдыңғы ${kept.length} нәтиже сақталды, ${queue.length} қайта жіберіледі`);
await Promise.all(Array.from({ length: Number(process.env.EVAL_CONCURRENCY ?? 4) }, async () => {
  while (queue.length) {
    const c = queue.shift();
    const r = await runCase(c);
    results.push(r);
    const bad = r.error ? `ERROR ${r.error}` : Object.entries(r.grades).filter(([, ok]) => !ok).map(([f]) => f).join(',');
    console.log(`${r.id} ${r.ms}ms ${bad || 'OK'}`);
  }
}));
results.sort((a, b) => a.id.localeCompare(b.id));

const ok = results.filter((r) => !r.error);
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const fieldRows = FIELDS.map((f) => {
  const graded = ok.filter((r) => f in r.grades);
  return { f, n: graded.length, pass: graded.filter((r) => r.grades[f]).length };
});
const checks = fieldRows.reduce((s, r) => s + r.n, 0);
const passed = fieldRows.reduce((s, r) => s + r.pass, 0);
const perfect = ok.filter((r) => Object.values(r.grades).every(Boolean)).length;
const byLang = (lang) => {
  const rs = ok.filter((r) => r.lang === lang);
  const all = rs.flatMap((r) => Object.values(r.grades));
  return pct(all.filter(Boolean).length, all.length);
};
const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
const median = ms.length ? ms[Math.floor(ms.length / 2)] : 0;
// Тегін тарифте квота біткенде резерв модельдер жауап береді — қайсысы қанша өңдегенін көрсетеміз
const models = Object.entries(ok.reduce((m, r) => ({ ...m, [r.model]: (m[r.model] ?? 0) + 1 }), {}))
  .map(([m, n]) => `\`${m}\` ×${n}`).join(', ');

const md = `# AI ауысым көмекшісінің дәлдігі

Іске қосылған уақыты: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · модельдер: ${models || '—'} · «бүгін» = ${today}

Тест жиыны: [scripts/ai-eval/cases.json](../scripts/ai-eval/cases.json) — ${cases.length} хабарландыру (${cases.filter((c) => c.lang === 'kk').length} қазақша, ${cases.filter((c) => c.lang === 'ru').length} орысша), әрқайсысына дұрыс жауап қолмен белгіленген.
Әдіс: әр өріс жеке тексеріледі — күн, уақыт, төлем, адам саны, санат дәл сәйкес болуы керек; атау, қала, мекенжай — рұқсат етілген нұсқалардың бірі кездессе дұрыс.

| Көрсеткіш | Мән |
|---|---|
| Өріс бойынша дәлдік (барлығы) | **${pct(passed, checks)}** (${passed}/${checks}) |
| Барлық өрісі дұрыс хабарландыру | ${pct(perfect, ok.length)} (${perfect}/${ok.length}) |
| Қазақша / орысша | ${byLang('kk')} / ${byLang('ru')} |
| Жауап уақыты (медиана) | ${(median / 1000).toFixed(1)} с |
| Қате жауаптар | ${results.length - ok.length} |

| Өріс | Дәлдік |
|---|---|
${fieldRows.map((r) => `| ${r.f} | ${pct(r.pass, r.n)} (${r.pass}/${r.n}) |`).join('\n')}

| Модель | Хабарландыру | Өріс бойынша дәлдік |
|---|---|---|
${[...new Set(ok.map((r) => r.model))].map((m) => {
    const rs = ok.filter((r) => r.model === m);
    const all = rs.flatMap((r) => Object.values(r.grades));
    return `| \`${m}\` | ${rs.length} | ${pct(all.filter(Boolean).length, all.length)} |`;
  }).join('\n')}

## Қате кеткен жағдайлар

${results.filter((r) => r.error || Object.values(r.grades).some((g) => !g)).map((r) => r.error
    ? `- **${r.id}** — қате: ${r.error}`
    : `- **${r.id}** — ${Object.entries(r.grades).filter(([, g]) => !g).map(([f]) => `${f}: \`${JSON.stringify(r.draft[f])}\`, күтілген \`${JSON.stringify(cases.find((c) => c.id === r.id).expect[f])}\``).join('; ')}`).join('\n') || 'Жоқ.'}
`;

if (only) console.log(JSON.stringify(results, null, 2));
else {
  writeFileSync(join(root, 'docs/ai-eval.md'), md);
  writeFileSync(join(here, 'last-run.json'), JSON.stringify(results, null, 2));
}
console.log(`\nДәлдік: ${pct(passed, checks)} · толық дұрыс: ${perfect}/${ok.length} · медиана ${median} мс → docs/ai-eval.md`);
// Тек осы скрипттің сессиясы (global болса, браузердегі кірулер де жабылады)
await supabase.auth.signOut({ scope: 'local' });
