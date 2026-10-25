// Карта мен IBAN-ды тексеру. Картаның толық нөмірі серверге жіберілмейді — тек соңғы 4 цифры.
import { PaymentMethod } from './types';

export const BANKS = [
  'Kaspi Bank', 'Halyk Bank', 'Freedom Bank', 'Bank CenterCredit', 'ForteBank', 'Jusan Bank',
  'Bereke Bank', 'Home Credit Bank', 'Eurasian Bank', 'RBK Bank', 'Altyn Bank', 'Otbasy Bank', 'Nurbank',
];
export const OTHER_BANK = 'other';

export const cardDigits = (v: string) => v.replace(/\D/g, '').slice(0, 19);

// '4400430112345678' → '4400 4301 1234 5678'
export const maskCardInput = (v: string) => cardDigits(v).replace(/(\d{4})(?=\d)/g, '$1 ');

// Luhn алгоритмі
export function isValidCard(v: string) {
  const d = cardDigits(v);
  if (d.length < 16) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

export function cardBrand(v: string): 'visa' | 'mastercard' | 'other' {
  const d = cardDigits(v);
  if (d.startsWith('4')) return 'visa';
  const two = Number(d.slice(0, 2));
  const four = Number(d.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return 'mastercard';
  return 'other';
}

export const normalizeIban = (v: string) => v.replace(/\s/g, '').toUpperCase().slice(0, 20);

// 'KZ12722S000012345678' → 'KZ12 722S 0000 1234 5678'
export const maskIbanInput = (v: string) => normalizeIban(v).replace(/(.{4})(?=.)/g, '$1 ');

// KZ IBAN: 20 таңба, mod-97 (серверде де is_valid_kz_iban тексереді)
export function isValidKzIban(v: string) {
  const s = normalizeIban(v);
  if (!/^KZ\d{2}[0-9A-Z]{16}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let r = 0;
  for (const ch of moved) {
    const n = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const digit of n) r = (r * 10 + Number(digit)) % 97;
  }
  return r === 1;
}

export function methodLabel(m: PaymentMethod) {
  if (m.kind === 'card') {
    const brand = m.card_brand === 'visa' ? 'Visa' : m.card_brand === 'mastercard' ? 'Mastercard' : '';
    return `${brand ? `${brand} ` : ''}•••• ${m.card_last4}`;
  }
  return `${m.iban?.slice(0, 4)} •••• ${m.iban?.slice(-4)}`;
}
