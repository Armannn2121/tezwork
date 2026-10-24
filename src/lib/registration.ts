import { DEFAULT_CITY, CITY_IDS } from './cities';
import { validateBin, validateIin } from './kz-id';
import { Role } from './types';

export type RegistrationDraft = {
  role: Role;
  full_name: string;
  company_name: string | null;
  company_bin: string;
  city: string;
  iin: string;
};

export const emptyDraft = (): RegistrationDraft => ({
  role: 'worker', full_name: '', company_name: '', company_bin: '', city: DEFAULT_CITY, iin: '',
});

// Тіркелу кезінде SMS-кодты растағанша профиль деректерін сақтаймыз.
// ЖСН user_metadata-ға жазылмайды (ол токенге түседі) — тек жадта.
let draft: RegistrationDraft | null = null;

export const setDraft = (d: RegistrationDraft | null) => { draft = d; };
export const getDraft = () => draft;

// user_metadata-ға тек жария деректер барады
export const publicMetadata = (d: RegistrationDraft) => ({
  role: d.role, full_name: d.full_name, company_name: d.company_name, company_bin: d.company_bin || null, city: d.city,
  terms_accepted_at: new Date().toISOString(),
});

export function draftFromMetadata(meta: Record<string, unknown> | undefined): RegistrationDraft | null {
  if (!meta) return null;
  const role = meta.role === 'business' || meta.role === 'worker' ? meta.role : null;
  const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
  if (!role || fullName.length < 2) return null;
  return {
    role,
    full_name: fullName,
    company_name: role === 'business' && typeof meta.company_name === 'string' ? meta.company_name : null,
    company_bin: typeof meta.company_bin === 'string' ? meta.company_bin : '',
    city: typeof meta.city === 'string' && CITY_IDS.includes(meta.city) ? meta.city : DEFAULT_CITY,
    iin: '',
  };
}

export type DraftErrors = Partial<Record<'full_name' | 'company_name' | 'company_bin' | 'iin', string>>;

// Қате кілттерін қайтарады (t() арқылы көрсетіледі)
export function validateDraft(d: RegistrationDraft, opts: { requireIin: boolean }): DraftErrors {
  const e: DraftErrors = {};
  if (d.full_name.trim().length < 2) e.full_name = 'form.fullNameErr';
  if (d.role === 'business') {
    if ((d.company_name ?? '').trim().length < 2) e.company_name = 'form.companyErr';
    if (d.company_bin) {
      const b = validateBin(d.company_bin);
      if (b) e.company_bin = b;
    }
  }
  // ЖСН екі рөлге де керек: жұмыс іздеуші — 16+, жұмыс беруші — 18+
  if (opts.requireIin || d.iin) {
    const i = validateIin(d.iin, d.role);
    if (i) e.iin = i;
  }
  return e;
}
