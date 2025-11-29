# Components Directory

## Purpose
Shared React components including shadcn/ui primitives and custom components.

## Structure
```
components/
├── ui/                # shadcn/ui components
│   ├── button.tsx     # Button with variants
│   ├── input.tsx      # Form input
│   ├── card.tsx       # Card container
│   ├── dialog.tsx     # Modal dialog
│   ├── select.tsx     # Dropdown select
│   └── skeleton.tsx   # Loading skeleton
├── navbar.tsx         # Site navigation
├── qr-scanner.tsx     # QR code scanner (camera + file)
└── icons.tsx          # Custom icon components
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
| `Skeleton` | Loading placeholder with `className` for sizing |

### Adding New shadcn Components
1. Run `bunx shadcn@latest add [name]`
2. Component added to `components/ui/`
3. Import from `@/components/ui/[name]`

## Custom Components

### Navbar (`navbar.tsx`)
- Responsive navigation with mobile menu
- Shows different links based on auth state
- Uses `AuthContext` for user info

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

### Icons (`icons.tsx`)
Custom SVG icons not available in lucide-react.

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
rg -n "export (function|const) " components/

# Find shadcn component usage
rg -n "from \"@/components/ui" app/

# Find icon usage
rg -n "from \"lucide-react\"" components/ app/
```

## Common Gotchas
- shadcn components are copied, not imported from package - edit directly if needed
- Always use `cn()` for conditional classes
- Lucide icons: use `size-x` class, not `width`/`height` props
- Custom colors (sage, sand) only work with Tailwind - not inline styles
