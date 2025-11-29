# Components Directory

## Purpose
Shared React components including shadcn/ui primitives, custom components, and admin dashboard components.

## Structure
```
components/
├── ui/                   # shadcn/ui components (17 components)
│   ├── button.tsx        # Button with variants
│   ├── input.tsx         # Form input
│   ├── card.tsx          # Card container
│   ├── dialog.tsx        # Modal dialog
│   ├── select.tsx        # Dropdown select
│   ├── calendar.tsx      # Date picker calendar
│   ├── sidebar.tsx       # Sidebar navigation (shadcn)
│   ├── sheet.tsx         # Slide-out panel
│   ├── table.tsx         # Data table
│   ├── tooltip.tsx       # Hover tooltip
│   ├── popover.tsx       # Floating popover
│   └── skeleton.tsx      # Loading skeleton
├── admin/                # Admin dashboard components
│   ├── sidebar.tsx       # Admin navigation sidebar
│   ├── dashboard-header.tsx
│   ├── stat-card.tsx     # KPI stat display
│   ├── chart-card.tsx    # Recharts wrapper
│   ├── recent-orders.tsx # Orders table
│   └── voucher-summary.tsx
├── navbar.tsx            # Public site navigation (scroll-aware)
├── footer13.tsx          # Premium footer (shadcnblocks)
├── feature76.tsx         # Feature section (shadcnblocks)
├── trust-features.tsx    # Trust indicators section
├── qr-scanner.tsx        # QR code scanner (camera + file)
├── theme-provider.tsx    # next-themes provider
├── theme-toggle.tsx      # Dark/light mode toggle
└── icons.tsx             # Custom icon components
```

## shadcn/ui Components

### Installation
```bash
bunx shadcn@latest add [component-name]
```

### Usage Pattern
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

<Button variant="outline" size="sm">Click</Button>
<Input placeholder="Enter text" className="w-full" />
```

### Available Components
| Component | Variants/Props |
|-----------|---------------|
| `Button` | `variant`: default, outline, ghost, destructive; `size`: default, sm, lg |
| `Input` | Standard input with Tailwind styling |
| `Card` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| `Dialog` | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle` |
| `Select` | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` |
| `Sheet` | Slide-out panel for mobile menus |
| `Sidebar` | Navigation sidebar with collapsible sections |
| `Table` | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` |
| `Calendar` | Date picker with react-day-picker |
| `Tooltip` | Hover tooltip with Radix |
| `Skeleton` | Loading placeholder with `className` for sizing |

### Adding New shadcn Components
```bash
bunx shadcn@latest add [name]
```

## Custom Components

### Navbar (`navbar.tsx`)
- Scroll-aware with transparent → solid transition (500ms)
- Color system: `text-primary-foreground` over hero, `text-foreground` when scrolled
- Staggered reveal animation on mount (75ms intervals)
- Mobile menu with collapse/expand animation
- Hidden on `/voucher` routes

### Footer (`footer13.tsx`)
- Premium footer from shadcnblocks registry
- Scroll-triggered animations (useInView hook)
- Newsletter subscription form
- 4-column nav links with stagger animation

### Trust Features (`trust-features.tsx`)
- Glass morphism cards with backdrop blur
- Data-driven rendering from `features` array
- Scroll-triggered fade-slide-up animation
- Icons: Zap, CalendarCheck, ShieldCheck

### QR Scanner (`qr-scanner.tsx`)
```tsx
import { QRScanner } from "@/components/qr-scanner";

<QRScanner
  onScan={(code) => handleCode(code)}
  onError={(error) => console.error(error)}
/>
```
- Camera scanning with jsqr
- File upload support
- Clipboard paste support

### Admin Components (`admin/`)
| Component | Purpose |
|-----------|---------|
| `sidebar.tsx` | Admin navigation with collapsible menu |
| `stat-card.tsx` | KPI display with icon + value |
| `chart-card.tsx` | Recharts line/bar chart wrapper |
| `recent-orders.tsx` | Latest orders table |
| `voucher-summary.tsx` | Voucher status breakdown |
| `dashboard-header.tsx` | Page header with title + actions |

## Component Patterns

### Client Component with Props
```tsx
"use client";

interface ComponentProps {
  title: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export function Component({ title, onAction, children }: ComponentProps) {
  return (
    <div className="...">
      <h2>{title}</h2>
      {children}
      {onAction && <Button onClick={onAction}>Action</Button>}
    </div>
  );
}
```

### Using Lucide Icons
```tsx
import { Check, X, Loader2, ChevronDown } from "lucide-react";

<Check className="size-4 text-green-600" />
<Loader2 className="size-4 animate-spin" />
```

## Styling Conventions

### Tailwind Classes
- Use `size-x` instead of `w-x h-x` when equal
- Use `gap-x` instead of margins for flex/grid spacing
- Custom colors: `sage-*`, `sand-*` (defined in globals.css)

### Class Merging
```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  className
)} />
```

## JIT Index
```bash
# Find component export
rg -n "export (function|const)" components/

# Find shadcn component usage
rg -n "from \"@/components/ui" app/

# Find icon usage
rg -n "from \"lucide-react\"" components/ app/

# Find admin component
rg -n "export" components/admin/

# Find animation usage
rg -n "animate-|useInView" components/
```

## Common Gotchas
- shadcn components are copied, not imported from package - edit directly if needed
- Always use `cn()` for conditional classes
- Lucide icons: use `size-x` class, not `width`/`height` props
- Animation classes: use utility classes from `globals.css` (animate-fade-slide-up, etc.)
- Scroll animations: wrap with `useInView` hook from `@/hooks/useInView`
- Navbar hidden on voucher routes - check pathname condition
