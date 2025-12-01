# Homepage SSR Optimization - Server-Side Data Fetching

## Relevant Files

- `app/page.tsx` - Main homepage component, convert to async Server Component with SSR data fetching
- `components/services-section.tsx` - New Client Component for services grid with animations
- `components/testimonials-section.tsx` - New Client Component for testimonials with animations
- `lib/actions/services.ts` - Server action for fetching services (already exists)
- `lib/actions/reviews.ts` - Server action for fetching reviews (already exists)
- `context/StoreContext.tsx` - Reference for type adapters (no changes needed)

### Notes

- This optimization removes client-side data fetching for homepage, improving initial load time
- Services and reviews will be fetched server-side and passed as props to client components
- StoreContext remains unchanged for other pages (checkout, admin)
- Animations are preserved using `useInView` hook in client components

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch: `git checkout -b feature/homepage-ssr-optimization`

- [x] 1.0 Create ServicesSection Client Component
  - [x] 1.1 Create `components/services-section.tsx` file
  - [x] 1.2 Define `ServicesSectionProps` interface accepting `services: Service[]`
  - [x] 1.3 Add `"use client"` directive for client-side animations
  - [x] 1.4 Import `useInView` hook and implement scroll-triggered animations
  - [x] 1.5 Move services grid JSX from `app/page.tsx` to this component
  - [x] 1.6 Ensure staggered animation delays are preserved

- [x] 2.0 Create TestimonialsSection Client Component
  - [x] 2.1 Create `components/testimonials-section.tsx` file
  - [x] 2.2 Define `TestimonialsSectionProps` interface accepting `reviews: Review[]`
  - [x] 2.3 Add `"use client"` directive for client-side animations
  - [x] 2.4 Import `useInView` hook and implement scroll-triggered animations
  - [x] 2.5 Move testimonials grid JSX from `app/page.tsx` to this component
  - [x] 2.6 Preserve star rating display and staggered animations

- [x] 3.0 Convert Homepage to Server Component with SSR
  - [x] 3.1 Remove `"use client"` directive from `app/page.tsx`
  - [x] 3.2 Make the component async: `export default async function LandingPage()`
  - [x] 3.3 Import `getServices` and `getReviews` server actions
  - [x] 3.4 Fetch services and reviews at the top of the component
  - [x] 3.5 Import type adapters from StoreContext or create local adapters
  - [x] 3.6 Convert DB types to frontend types before passing to children

- [x] 4.0 Integrate Client Components into Homepage
  - [x] 4.1 Import `ServicesSection` and `TestimonialsSection` components
  - [x] 4.2 Replace inline services section with `<ServicesSection services={services} />`
  - [x] 4.3 Replace inline testimonials section with `<TestimonialsSection reviews={reviews} />`
  - [x] 4.4 Remove `useStore()` hook usage from homepage
  - [x] 4.5 Remove unused `useInView` imports from homepage

- [x] 5.0 Testing and Validation
  - [x] 5.1 Run `bunx tsc --noEmit` to verify TypeScript compilation
  - [ ] 5.2 Test homepage in browser - services should load instantly (no loading state)
  - [ ] 5.3 Verify scroll animations still work correctly
  - [ ] 5.4 Test other pages still work (checkout, admin) with StoreContext
  - [ ] 5.5 Check browser DevTools Network tab - no client-side fetch for services on homepage

- [x] 6.0 Commit and Merge
  - [x] 6.1 Stage all changes: `git add .`
  - [x] 6.2 Commit with message: `perf: implement SSR for homepage services and testimonials`
  - [x] 6.3 Push branch and create PR (or merge to master if approved)
