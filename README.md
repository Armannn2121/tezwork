# TezWork

Қазақстандағы сағаттық (ауысымдық) жұмыс платформасы. Expo SDK 58 + Expo Router + Supabase.

- **Орындаушы** — ауысымдарды қала, күн, санат бойынша сүзеді, бір түртумен жазылады, табысын көреді.
- **Бизнес** — ауысым жариялайды (күн/уақыт таңдағышы, сағаттық есеп, алдын ала қарау), жазылғандарды «Келді» / «Аяқтады» деп белгілейді, ауысымды көшіреді немесе жабады.

## Іске қосу

```bash
npm install
npx expo start
```

`.env` ішінде `EXPO_PUBLIC_SUPABASE_URL` және `EXPO_PUBLIC_SUPABASE_ANON_KEY` болуы керек.

## Supabase

Кіру — телефон + SMS-код (Supabase Phone Auth). «Кіру» тек бар аккаунттарға код жібереді (`shouldCreateUser: false`), «Тіркелу» рөл/аты/қала деректерін `user_metadata`-ға сақтап, кодты растағаннан кейін профильді автоматты құрады.

Жаңа функцияларға қажет SQL: `supabase/migrations/` — Supabase SQL Editor ішінде іске қосыңыз.

Қолданылатын RPC-лер: `list_open_shifts`, `apply_to_shift`, `cancel_application`, `my_applications`, `my_business_shifts`, `shift_applicants`, `delete_my_account`, `set_application_status` (жаңа).

## Құрылым

```
src/app/            маршруттар (Expo Router)
  (auth)/           welcome, login, register, verify
  (tabs)/           index, create, my, profile
  shift/[id].tsx    ауысымның толық беті
  onboarding.tsx    профиль жоқ болған жағдайда
  profile-edit.tsx
src/components/     ShiftCard, PhoneField, OtpInput, пикерлер, AuthShell
src/lib/            supabase, session, ui, theme, feedback (toast/confirm), format, errors
```

## Тексеру

```bash
npx tsc --noEmit
npx expo lint
```
