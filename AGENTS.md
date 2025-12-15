# Kalanara Spa Voucher Platform

## Project Snapshot
Next.js 16 App Router + Supabase spa voucher booking platform. Indonesian market (IDR currency).
Features: Public voucher catalog, checkout with WhatsApp/Email delivery, admin dashboard, QR redemption.
See sub-AGENTS.md files for detailed guidance per directory.

## Quick Commands
```bash
bun install          # Install dependencies
bun run dev          # Start dev server (localhost:3000)
bun run build        # Production build
bun run lint         # ESLint check
bunx tsc --noEmit    # TypeScript check (use this, NOT bun run build)
```

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: TailwindCSS 4, shadcn/ui components
- **Database**: Supabase (PostgreSQL + Auth)
- **State**: Zustand (client state), React Context (auth, toast)
- **Email**: Resend API
- **PDF**: jspdf + qrcode
- **Forms**: react-hook-form
- **Charts**: Recharts (admin dashboard)
- **Animations**: CSS keyframes + Intersection Observer (see `globals.css`)

## Universal Conventions

### Code Style
- Use TypeScript strict mode
- Prefer `const` over `let`, no `var`
- Use absolute imports with `@/` prefix
- File naming: `kebab-case.tsx` for components, `camelCase.ts` for utilities
- Indonesian language for user-facing text

### Component Patterns
- Use `"use client"` directive only when needed (hooks, events, browser APIs)
- Server Components by default
- Props interfaces named `{Component}Props`

### Animation Patterns
- Use CSS keyframes defined in `globals.css` (fadeSlideUp, scaleIn, etc.)
- Scroll-triggered: `useInView` hook from `hooks/useInView.ts`
- Stagger delays: `animate-stagger-1` through `animate-stagger-6`
- Hover effects: `btn-hover-lift`, `card-hover-lift`, `img-hover-zoom`
- Always respect `prefers-reduced-motion`

### Git & Commits
- Branch: `feature/`, `fix/`, `chore/` prefixes
- Commits: Conventional Commits format (`feat:`, `fix:`, `docs:`, `chore:`)
- Always run `bunx tsc --noEmit` before committing

## Security & Secrets
- NEVER commit `.env.local` or expose keys in client code
- Supabase keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-safe)
- Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`
- Use `lib/supabase/server.ts` for server-side operations with service role

## JIT Index

### Directory Map
| Directory | Purpose | Details |
|-----------|---------|---------|
| `app/` | Pages & API routes | [app/AGENTS.md](app/AGENTS.md) |
| `lib/` | Utils, types, actions | [lib/AGENTS.md](lib/AGENTS.md) |
| `components/` | UI components | [components/AGENTS.md](components/AGENTS.md) |
| `context/` | React contexts | [context/AGENTS.md](context/AGENTS.md) |
| `hooks/` | Custom React hooks | [hooks/AGENTS.md](hooks/AGENTS.md) |

### Quick Find Commands
```bash
# Find component
rg -n "export.*function" components/

# Find server action
rg -n "use server" lib/actions/

# Find API route
rg -n "export async function (GET|POST)" app/api/

# Find type definition
rg -n "export (interface|type|enum)" lib/types.ts

# Find Supabase query
rg -n "supabase\.(from|rpc)" lib/

# Find hook
rg -n "export function use" hooks/

# Find context usage
rg -n "useContext|createContext" context/
```

## Environment Variables
```env
# Required (.env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=  # For email/WhatsApp links

# Midtrans Payment Gateway
MIDTRANS_SERVER_KEY=           # Server-side only (SB-Mid-server-xxx for sandbox)
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=  # Client-side (SB-Mid-client-xxx for sandbox)
MIDTRANS_IS_PRODUCTION=false   # Set to "true" for production
```

See [docs/midtrans-setup.md](docs/midtrans-setup.md) for detailed Midtrans configuration guide.

## Definition of Done
Before PR/commit:
1. `bunx tsc --noEmit` passes
2. `bun run lint` passes (warnings OK, no errors)
3. Manual test affected feature in browser
4. No console errors in dev tools
