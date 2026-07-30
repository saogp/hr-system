# ZEST – internportal for ansatte

En intern HR-portal (kontrakter, medarbeidersamtaler, undersøkelser, personalutstyr, renhold, si-fra). Denne filen forklarer teknologiene appen er bygget med, så du kan lese tilbake og forstå hva som faktisk skjer under panseret.

## Oversikt over teknologiene

### Next.js (rammeverket appen er bygget i)
Selve nettsiden er skrevet i **Next.js** (versjon 16), som er et rammeverk bygget på **React**. Dette er koden i `app/`-mappen — hver undermappe (`app/contracts`, `app/reviews`, `app/settings` osv.) er én side i appen. Serveren som kjører dette er det du starter lokalt med `npm run dev`.

### Supabase (database, innlogging og fillagring)
**Supabase** er "backend-en" — alt appen lagrer og all innlogging går gjennom Supabase. Det er egentlig tre ting i ett:
- **Database (Postgres)**: alle tabellene — ansatte, kontrakter, undersøkelser, renholdssjekker osv. Migrasjonene (SQL-filene i prosjektroten, `supabase-migration-*.sql`) er historikken over hvordan databasen har blitt bygget opp steg for steg.
- **Auth (innlogging)**: når noen logger inn, inviteres som ny ansatt, eller tilbakestiller passord, er det Supabase som håndterer dette — inkludert e-postene som sendes ved invitasjon/passord-reset (disse e-postene kommer altså IKKE fra Resend, se under).
- **Storage**: private filer som avviksbilder fra renhold (`cleaning-photos`) og PDF-vedlegg til fellesmail (`broadcast-attachments`) ligger her, ikke i databasen direkte.

Du styrer Supabase-prosjektet ditt fra [supabase.com](https://supabase.com) → prosjektets dashboard. Nøklene som kobler appen til riktig Supabase-prosjekt ligger i `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

### Vercel (hvor appen faktisk kjører for andre enn deg)
Når du kjører `npm run dev` kjører appen kun på din egen maskin (`localhost`). **Vercel** er tjenesten som hoster den ferdige appen på internett, slik at ansatte faktisk kan bruke den på en ekte lenke (`https://hr-system-sogp.vercel.app` eller en egen domene om du setter det opp). Vercel er laget av samme selskap som Next.js, så de to henger godt sammen.

Vercel bygger og deployer automatisk en ny versjon hver gang kode pushes til GitHub (se under). Miljøvariabler (som Supabase-nøklene og `RESEND_API_KEY`) må også legges inn i Vercel sitt dashboard (Project → Settings → Environment Variables) — det som står i `.env.local` lokalt påvirker ikke den live nettsiden.

Vercel har også en innstilling ("Deployment Protection" / "Vercel Authentication") som avgjør om man må logge inn med en Vercel-konto for å i det hele tatt åpne siden — nyttig å vite om hvis noen sier de ikke får opp siden i det hele tatt.

### GitHub (der koden lagres og versjoneres)
**Git** er systemet som holder styr på hver eneste endring som gjøres i koden (som en "angre"-historikk for hele prosjektet), og **GitHub** er nettstedet som lagrer denne historikken i skyen. Vercel er koblet til GitHub-repoet ditt — hver gang noe pushes dit, trigges en ny utrulling på Vercel automatisk.

### Resend (utgående e-post appen sender selv)
**Resend** er en tjeneste for å sende e-post *fra appens kode* — altså e-poster appen selv bestemmer innhold og utseende på, i motsetning til Supabase sine innloggings-/passord-e-poster. Dette gjelder:
- Kontrakt sendt til ansatt
- Kontrakt sendt til regnskapsfører
- Ny undersøkelse sendt til mottakere
- Medarbeidersamtale planlagt
- Fellesmail til alle ansatte
- Daglig renholds-oppsummering
- Personalutstyr utlevert

Uten en gyldig `RESEND_API_KEY` i miljøvariablene vil disse e-postene rett og slett ikke bli sendt (appen gir da en tydelig feilmelding i stedet for å late som den virker). Utseendet på e-postene er definert ett sted (`lib/email-template.ts`) og gjenbrukes av alle e-posttypene over, så de ser like merkevare-messige ut.

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000). Du trenger en gyldig `.env.local` (se `.env.local.example` om den finnes, eller spør om hvilke variabler som trengs) for at innlogging og datalagring skal fungere.

## Miljøvariabler som trengs

| Variabel | Hva den gjør |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adressen til Supabase-prosjektet |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Offentlig nøkkel appen bruker i nettleseren |
| `SUPABASE_SERVICE_ROLE_KEY` | Hemmelig nøkkel kun brukt server-side (aldri i nettleseren) |
| `NEXT_PUBLIC_SITE_URL` | Den faktiske URL-en til appen (brukes bl.a. i QR-koder og lenker i e-poster) |
| `RESEND_API_KEY` | Nødvendig for at appen skal kunne sende e-post selv |
| `RESEND_FROM_EMAIL` | Hvilken avsenderadresse e-postene skal se ut til å komme fra (valgfritt — faller tilbake til en generisk Resend-adresse om den mangler) |
| `CRON_SECRET` | Beskytter den planlagte jobben som sletter gamle avviksbilder automatisk |

## Mappestruktur i korte trekk

- `app/` — hver side i appen, organisert som mapper (Next.js "App Router")
- `app/api/` — serverkode (endepunkter) appen selv snakker med, bl.a. alt som sender e-post
- `components/` — gjenbrukbare UI-byggeklosser
- `lib/` — delt logikk (Supabase-klienter, e-postmal, valideringsregler osv.)
- `supabase-migration-*.sql` — historikken over endringer gjort i databasen
