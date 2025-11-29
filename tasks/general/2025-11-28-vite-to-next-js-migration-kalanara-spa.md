## Migration Plan: Vite to Next.js (Full App Router)

### Overview
Migrate Kalanara Spa voucher website from Vite (react-router-dom) to Next.js 16 App Router with 7 routes.

---

### Phase 1: Dependencies & Configuration

**1.1 Install Dependencies**
```bash
bun add react-hook-form recharts react-qr-code jspdf jsqr qrcode @emailjs/browser
bun add -D @types/qrcode
```

**1.2 Update Tailwind Configuration (`globals.css`)**
- Add custom `sage` and `sand` color palettes from Vite project
- Add `font-sans` (Inter) and `font-serif` (Playfair Display) font families

**1.3 Update Root Layout (`app/layout.tsx`)**
- Replace Geist fonts with Inter + Playfair Display using `next/font/google`
- Update metadata for Kalanara Spa

**1.4 Environment Variables**
- Create `.env.local` with `GEMINI_API_KEY=PLACEHOLDER_API_KEY` (server-side)

---

### Phase 2: Core Files Migration

**2.1 Types & Constants**
- `lib/types.ts` - Copy all TypeScript interfaces/enums
- `lib/constants.ts` - Copy mock data and app constants

**2.2 Context Providers (Client Components)**
- `context/StoreContext.tsx` - State management with localStorage
- `context/AuthContext.tsx` - Authentication state
- `context/ToastContext.tsx` - Toast notifications

**2.3 Components**
- `components/icons.tsx` - Re-export lucide-react icons
- `components/navbar.tsx` - Convert `Link`/`useNavigate` to Next.js equivalents
- Wrap app with providers in layout

---

### Phase 3: Route Structure

```
app/
├── layout.tsx              # Root layout with providers
├── page.tsx                # LandingPage (/)
├── voucher/
│   └── [id]/
│       └── page.tsx        # VoucherDetail (/voucher/:id)
├── checkout/
│   └── [id]/
│       └── page.tsx        # Checkout (/checkout/:id)
├── verify/
│   └── page.tsx            # VerifyVoucher (/verify)
├── review/
│   └── [id]/
│       └── page.tsx        # ReviewPage (/review/:id)
└── admin/
    ├── login/
    │   └── page.tsx        # AdminLogin (/admin/login)
    └── dashboard/
        └── page.tsx        # AdminDashboard (/admin/dashboard)
```

---

### Phase 4: Key Conversions

| Vite (react-router-dom) | Next.js App Router |
|-------------------------|-------------------|
| `import { Link } from 'react-router-dom'` | `import Link from 'next/link'` |
| `<Link to="/path">` | `<Link href="/path">` |
| `useNavigate()` | `useRouter()` from `next/navigation` |
| `navigate('/path')` | `router.push('/path')` |
| `navigate(-1)` | `router.back()` |
| `useParams()` | `params` prop in page components |
| `useLocation()` | `usePathname()` from `next/navigation` |
| `a href="/#services"` | Keep as-is (hash links work) |

---

### Phase 5: shadcn/ui Component Integration

Replace custom components with shadcn/ui where beneficial:
- **Button** - Already installed, use for CTAs
- **Input** - Form inputs styling
- **Card** - Service cards, voucher cards
- **Toast** - Replace custom ToastContext with shadcn toast (optional, can keep custom)
- **Dialog** - Admin modals
- **Select** - Dropdown selects

*Note: Will match original Vite design aesthetics while using shadcn primitives*

---

### Migration Checklist

1. [ ] Install dependencies
2. [ ] Update `globals.css` with sage/sand colors + fonts
3. [ ] Update `layout.tsx` with Inter + Playfair Display
4. [ ] Create `lib/types.ts` and `lib/constants.ts`
5. [ ] Create context providers (StoreContext, AuthContext, ToastContext)
6. [ ] Create `components/icons.tsx`
7. [ ] Create `components/navbar.tsx`
8. [ ] Create all 7 page routes
9. [ ] Add shadcn/ui components as needed
10. [ ] Test all routes and functionality
11. [ ] Type check with `bunx tsc --noEmit`

---

### Estimated Files to Create/Modify

| Action | Count |
|--------|-------|
| New files | ~15 |
| Modified files | ~3 (layout, globals.css, package.json) |

---

### Notes
- All page components will be Client Components (`'use client'`) since they use hooks (useState, useEffect, useContext)
- localStorage persistence maintained for now; Supabase integration planned for later
- HashRouter hash links (`/#services`) converted to regular anchor links
- AdminDashboard protected route logic kept client-side via useEffect redirect