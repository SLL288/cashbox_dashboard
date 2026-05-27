# Cashbox Web Dashboard

Read-only accountant dashboard for Gold Field Cashbox records stored in Supabase.

## Local Dev

```bash
npm install
npm run dev
```

## Environment

Create `.env` or set these in Cloudflare Pages:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Cloudflare Pages

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Security Note

This first version uses the browser publishable key and depends on Supabase Row Level Security.
Before real accounting use, replace prototype anon full-access policies with read-only accountant policies.
