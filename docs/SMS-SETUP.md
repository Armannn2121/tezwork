# Кодты кез келген нөмірге жеткізу — баптау нұсқаулығы

## Қазіргі жағдай (2026-10-25)

- `+7 777 123 45 67` жұмыс істейді, себебі ол Supabase-тегі **тест нөмірі**: SMS жіберілмейді, код алдын ала белгіленген.
- Нақты нөмірлерге код бармайды. Supabase логында Twilio қатесі: `Authentication Error - invalid username` ([20003](https://www.twilio.com/docs/errors/20003)) — Twilio кілттері қате.

## Тегін / арзан нұсқалар

| Жол | Құны | Кімге жетеді | Ескерту |
|---|---|---|---|
| Supabase тест нөмірлері | тегін | тек тізімге қосылған нөмірлер, код тұрақты | тестке ғана |
| `log` режимі (біздің hook) | тегін | ешкімге — код Supabase логында көрінеді | тестке ғана |
| **Telegram Gateway** | өз нөміріңізге және тестке тегін, қалғаны ≈ $0.01 / код | Telegram-ы бар кез келген нөмір | ұсынылады |
| SMSC.kz / Mobizon | ≈ 10–20 ₸ / SMS | кез келген KZ нөмірі | Telegram-ы жоқтарға қосалқы жол |
| Twilio | ең қымбаты, trial тек расталған нөмірлерге | кез келген | upgrade керек |

## 1-қадам. Қазір тегін тестілеу (5 минут)

Supabase → **Authentication → Sign In / Providers → Phone → Test Phone Numbers and OTPs** бөліміне өз нөмірлеріңізді қосыңыз, мысалы:

```
77784742126=123456
```

Сол нөмірмен кіргенде код ретінде `123456` енгізіледі. SMS жіберілмейді, ақша кетпейді.

## 2-қадам. Telegram Gateway (ұсынылады)

1. https://gateway.telegram.org ашып, Telegram аккаунтымен кіріңіз.
2. **API Token** алыңыз. Өз нөміріңізге жіберу тегін, сондықтан алдымен соны сынаймыз.
3. Нағыз пайдаланушыларға жіберу үшін кейін балансты толтыру керек.

Код SMS ретінде емес, Telegram-дағы ресми «Verification Codes» чатына келеді. Сондықтан нөмірде Telegram болуы керек. Telegram-ы жоқ адамдарға қосалқы ретінде SMSC.kz қосуға болады: `SMS_PROVIDERS=telegram,smsc`.

## 3-қадам. Функцияны іске қосу (Claude жасайды, сіздің рұқсатыңызбен)

Код дайын: `supabase/functions/send-sms-hook/index.ts`.

1. Claude функцияны Supabase-ке deploy жасайды (JWT тексерісі өшірулі: hook өз қолтаңбасын тексереді).
2. Supabase → **Authentication → Hooks → Send SMS** → **HTTPS** түрін таңдаңыз:
   - URL: `https://aldksavulxsgixfubprq.supabase.co/functions/v1/send-sms-hook`
   - **Generate secret** басып, құпияны көшіріңіз.
3. Supabase → **Edge Functions → Secrets** бөліміне **өзіңіз** қосыңыз:
   - `SEND_SMS_HOOK_SECRET` — 2-тармақтағы құпия (`v1,whsec_...`)
   - `SMS_PROVIDERS` — алдымен `log` (тегін тест), кейін `telegram`
   - `TELEGRAM_GATEWAY_TOKEN` — Telegram Gateway токені
   - (қаласаңыз) `SMSC_LOGIN`, `SMSC_PASSWORD`, `SMSC_SENDER`

Hook қосылғаннан кейін Twilio баптаулары қолданылмайды.

> Құпия кілттерді чатқа жазбаңыз — оларды тек Supabase Dashboard-қа енгізіңіз.

## 4-қадам. Тексеру

1. `SMS_PROVIDERS=log` қойып, қосымшада кез келген нөмірге «Код алу» басыңыз → Supabase → Logs → Edge Functions ішінде `[send-sms-hook] +7… → 123456` жолы шығады → сол кодты енгізіңіз.
2. `SMS_PROVIDERS=telegram` қойып, өз нөміріңізге сынаңыз — код Telegram-ға келуі керек.

## Ертең шешетін сұрақтар

- Код Telegram-ға келсе, қосымшадағы «SMS-код» мәтінін «Telegram немесе SMS арқылы код» деп өзгертеміз бе?
- SMSC.kz қосалқы жолын қосамыз ба? Ол үшін smsc.kz-та аккаунт керек. API параметрлерін (`/sys/send.php`, `fmt=3`) тіркелгеннен кейін олардың құжатымен салыстырып тексеру керек.
