## Kalanara Voucher

Platform voucher spa berbasis Next.js 16 + Supabase.

## Getting Started

First, run the development server:

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Sentry Setup

Project ini sudah terhubung dengan `@sentry/nextjs` untuk error logging di:

- Client-side render errors
- App Router error boundaries
- Server runtime dan Edge runtime lewat `instrumentation.ts`

Isi environment variable berikut di `.env.local`:

```env
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENV=development
SENTRY_DSN=
SENTRY_ENV=development
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

Catatan:

- `NEXT_PUBLIC_SENTRY_DSN` cukup untuk mengirim error dari browser.
- `SENTRY_DSN` opsional jika ingin memisahkan DSN server dari client.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, dan `SENTRY_PROJECT` dibutuhkan saat ingin upload source map pada build production.

## Validation

```bash
bunx tsc --noEmit
bun run lint
```

`bun run lint` saat ini masih gagal karena ada error lama di file lain di luar perubahan Sentry.

## Relevant Files

- `instrumentation.ts`
- `instrumentation-client.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `app/error.tsx`
- `app/global-error.tsx`
- `app/admin/error.tsx`
- `next.config.ts`

Dokumentasi Sentry Next.js: [docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup)
