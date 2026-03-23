# AI Visibility Index (AVI)
**AI Visibility Intelligence Platform**

---

## Come mettere online il progetto (passo per passo)

### Passo 1 — GitHub

1. Vai su [github.com](https://github.com) → **New repository**
2. Nome: `seageo` → **Create repository**
3. Sul tuo Mac, apri il Terminale nella cartella del progetto:
```bash
cd /percorso/alla/cartella/seageo
git init
git add .
git commit -m "Initial commit — AVI Phase 1"
git remote add origin https://github.com/TUO-USERNAME/seageo.git
git push -u origin main
```

---

### Passo 2 — Supabase

1. Vai su [supabase.com](https://supabase.com) → **New project**
2. Scegli un nome (es. `seageo`) e una password per il DB
3. Vai su **SQL Editor** nel menu a sinistra
4. Copia tutto il contenuto di `supabase/migrations/001_initial_schema.sql`
5. Incollalo nell'editor e clicca **Run**
6. Vai su **Project Settings → API** e copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

**Attiva Google Login (opzionale):**
- Supabase → **Authentication → Providers → Google**
- Inserisci Client ID e Client Secret dalla Google Cloud Console
- Redirect URL: `https://xxx.supabase.co/auth/v1/callback`

---

### Passo 3 — Vercel

1. Vai su [vercel.com](https://vercel.com) → **Add New Project**
2. Collega il repository GitHub `seageo`
3. Framework: **Next.js** (rilevato automaticamente)
4. Vai su **Environment Variables** e aggiungi:

| Variabile | Valore |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | (da Supabase) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (da Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | (da Supabase) |
| `OPENAI_API_KEY` | (da OpenAI) |
| `ANTHROPIC_API_KEY` | (da Anthropic) |
| `NEXT_PUBLIC_APP_URL` | (URL Vercel del progetto) |

5. Clicca **Deploy** → il sito è online in 2 minuti

**Da quel momento: ogni push su GitHub → Vercel rideploya in automatico.**

---

### Passo 4 — Test locale

```bash
npm install
cp .env.example .env.local
# Riempi .env.local con le variabili Supabase
npm run dev
# Apri http://localhost:3000
```

---

## Struttura del progetto

```
seageo/
├── app/
│   ├── (auth)/          → pagine login/register
│   ├── (dashboard)/     → tutte le pagine della piattaforma
│   │   ├── dashboard/   → home con AVI e metriche
│   │   ├── projects/    → gestione progetti
│   │   ├── analysis/    → lancia analisi
│   │   ├── results/     → risultati
│   │   ├── competitors/ → competitor discovery
│   │   ├── sources/     → fonti estratte
│   │   ├── topics/      → topic discovery
│   │   └── compare/     → confronto modelli
│   └── api/             → API routes (backend integrato)
├── components/          → componenti UI riutilizzabili
├── lib/                 → logica condivisa
├── types/               → tipi TypeScript
└── supabase/
    └── migrations/      → schema SQL del database
```

---

## Roadmap

| Fase | Stato | Contenuto |
|------|-------|-----------|
| 1    | ✅    | Setup, auth, DB schema, layout, dashboard |
| 2    | 🔜    | Creazione progetti, query, segmenti (UI completa) |
| 3    | 🔜    | Connettori LLM (OpenAI, Claude, Gemini…) |
| 4    | 🔜    | Pipeline estrazione (brand, competitor, topic, URL) |
| 5    | 🔜    | AVI Engine — calcolo e storico |
| 6    | 🔜    | Pagine risultati, sources, topics, competitors |
| 7    | 🔜    | Export Excel + PDF |
| 8    | 🔜    | Report condivisibili (link pubblico) |
| 9    | 🔜    | Confronto multi-modello |
