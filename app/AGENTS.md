# App Directory (Next.js App Router)

## Purpose
Next.js 16 App Router pages and API routes. Public spa voucher platform + admin dashboard.

## Route Structure
```
app/
├── page.tsx           # Landing page (public catalog)
├── layout.tsx         # Root layout with providers
├── globals.css        # Tailwind + custom styles
├── loading.tsx        # Global loading skeleton
├── error.tsx          # Global error boundary
├── checkout/[id]/     # Voucher purchase flow
├── voucher/[id]/      # Voucher detail page
├── verify/            # Voucher verification (public)
├── review/[id]/       # Post-redemption review
├── admin/             # Protected admin routes
│   ├── login/         # Admin authentication
│   ├── dashboard/     # Analytics & stats
│   ├── vouchers/      # Voucher management
│   └── services/      # Service CRUD
└── api/               # API routes
    ├── email/         # Resend email sending
    └── whatsapp/      # WhatsApp URL generation
```

## Page Patterns

### Client Components
```tsx
// Use "use client" for interactive pages
"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";

export default function PageName() {
  // hooks, state, handlers
}
```

### Dynamic Routes
```tsx
// app/checkout/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>;  // Next.js 16+ async params
}

export default function CheckoutPage({ params }: PageProps) {
  const { id } = use(params);  // React 19 use() hook
  // ...
}
```

### Loading States
- Create `loading.tsx` in route folder for Suspense fallback
- Use `@/components/ui/skeleton` for loading UI
- Example: `app/admin/loading.tsx`

### Error Handling
- Create `error.tsx` for route-level error boundaries
- Must be client component with `reset` function
- Example: `app/error.tsx`, `app/admin/error.tsx`

## API Routes

### Pattern
```tsx
// app/api/[feature]/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // validate, process
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "message" }, { status: 400 });
  }
}
```

### Existing APIs
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/email/send-voucher` | POST | Send voucher via Resend |
| `/api/whatsapp/send-voucher` | POST | Generate WhatsApp URL |

## Admin Routes
- Protected by `middleware.ts` (checks Supabase auth)
- Uses `AuthContext` for client-side auth state
- Roles: `SUPER_ADMIN`, `MANAGER`, `STAFF`

## Key Files
| File | Purpose |
|------|---------|
| `layout.tsx` | Providers: Auth, Store, Toast, ThemeProvider |
| `page.tsx` | Landing with service catalog + animations |
| `globals.css` | Tailwind + animation keyframes + utility classes |
| `checkout/[id]/page.tsx` | Full checkout with delivery options |
| `verify/page.tsx` | QR scanner + voucher verification |

## Animation System
Defined in `globals.css`:

### Keyframes
- `fadeSlideUp`, `fadeSlideDown` - Content reveals
- `scaleIn` - Modal/card entrances
- `slideInLeft` - Back button animations
- `pulse`, `checkmarkPop` - Success indicators

### Utility Classes
```css
.animate-fade-slide-up     /* Fade + slide up */
.animate-scale-in          /* Scale entrance */
.animate-stagger-1 to -6   /* Stagger delays 100-600ms */
.btn-hover-lift            /* Button hover effect */
.card-hover-lift           /* Card hover effect */
.img-hover-zoom            /* Image zoom on hover */
```

### Usage Pattern
```tsx
const [ref, isInView] = useInView();

<div ref={ref} className={isInView ? "animate-fade-slide-up" : "opacity-0"}>
  Content
</div>
```

## Common Gotchas
- `params` is async in Next.js 16 - use `use(params)` or `await params`
- Admin routes need both middleware check AND client-side auth check
- Use `@/` imports, not relative `../../../`
- Images: Use `next/image` with proper `width`/`height` or `fill`
- Animations: Always set initial `opacity-0` before `isInView` triggers
- `prefers-reduced-motion` is respected via media query in globals.css
