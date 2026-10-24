import { CITIES, Role } from './types';

export type RegistrationDraft = {
  role: Role;
  full_name: string;
  company_name: string | null;
  city: string;
};

// Тіркелу кезінде SMS-кодты растағанша профиль деректерін сақтаймыз.
// Қосымша жабылып қалса, сол деректер user_metadata-дан алынады.
let draft: RegistrationDraft | null = null;

export const setDraft = (d: RegistrationDraft | null) => { draft = d; };
export const getDraft = () => draft;

export function draftFromMetadata(meta: Record<string, unknown> | undefined): RegistrationDraft | null {
  if (!meta) return null;
  const role = meta.role === 'business' || meta.role === 'worker' ? meta.role : null;
  const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
  if (!role || fullName.length < 2) return null;
  return {
    role,
    full_name: fullName,
    company_name: role === 'business' && typeof meta.company_name === 'string' ? meta.company_name : null,
    city: typeof meta.city === 'string' && CITIES.includes(meta.city) ? meta.city : CITIES[0],
  };
}

export function validateDraft(d: RegistrationDraft): Partial<Record<'full_name' | 'company_name', string>> {
  const errors: Partial<Record<'full_name' | 'company_name', string>> = {};
  if (d.full_name.trim().length < 2) errors.full_name = 'Аты-жөніңізді жазыңыз';
  if (d.role === 'business' && (d.company_name ?? '').trim().length < 2) errors.company_name = 'Компания атауын жазыңыз';
  return errors;
}
