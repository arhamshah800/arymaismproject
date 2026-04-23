# Aryma ISM

Professional restaurant workflow app with:

- Login/create-account flow
- Business-aware dashboard workflows
- AI assistant integration via `/api/chat`
- Server-side auth with HttpOnly sessions
- Managed Postgres persistence
- App-level encrypted private data at rest

## Requirements

- Node.js 20+
- npm 10+
- A Postgres database URL (Neon/Supabase/etc.)

## Environment Variables

Create `.env.local` with:

```bash
DATABASE_URL=postgresql://...
APP_DATA_ENCRYPTION_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

### Generate Encryption Key

Run:

```bash
npm run key:generate
```

Use either printed value (`hex` or `base64`) as `APP_DATA_ENCRYPTION_KEY`.

## Local Development

```bash
npm install
npm run db:init
npm run dev
```

App runs on [http://localhost:3000](http://localhost:3000).

## Managed DB Migration Runbook (Step-by-Step)

1. Create a free managed Postgres project (for example Neon or Supabase).
2. Copy the connection string into `DATABASE_URL`.
3. Generate an app encryption key:
   ```bash
   npm run key:generate
   ```
4. Save it as `APP_DATA_ENCRYPTION_KEY` in `.env.local`.
5. Initialize schema:
   ```bash
   npm run db:init
   ```
6. If you have old local-file data, migrate it:
   ```bash
   npm run db:migrate-local
   ```
   Optional source override:
   ```bash
   MIGRATION_SOURCE_PATH=/absolute/path/to/store.v1.json npm run db:migrate-local
   ```
7. Validate app locally:
   ```bash
   npm run lint
   npm run build
   npm run dev
   ```
8. In Vercel project settings, add the same env vars:
   - `DATABASE_URL`
   - `APP_DATA_ENCRYPTION_KEY`
   - `GOOGLE_GENERATIVE_AI_API_KEY`
9. Deploy to Vercel and verify:
   - Create account/login works
   - Dashboard data persists after refresh
   - `/api/chat` returns valid responses
10. After successful cutover, stop using `.secure-data/store.v1.json` as the source of truth.

## Privacy and Security Notes

- Passwords are hashed using `scrypt` with per-password salt.
- Session cookies are `HttpOnly` and server-validated.
- Private profile/dashboard payload is encrypted before writing to Postgres (`encrypted_data` column).
- Public GitHub source code does not expose your runtime secrets unless you commit env files or paste keys into code.

## Scripts

- `npm run dev` - start dev server
- `npm run lint` - run ESLint
- `npm run build` - production build check
- `npm run db:init` - create managed DB schema
- `npm run db:migrate-local` - migrate `.secure-data/store.v1.json` into Postgres
- `npm run key:generate` - generate secure encryption key values
