# Hooks Directory

## Purpose
Custom React hooks for reusable logic across the application.

## Structure
```
hooks/
├── useInView.ts      # Intersection Observer for scroll animations
└── use-mobile.ts     # Mobile viewport detection
```

## Available Hooks

### useInView (`useInView.ts`)
Scroll-triggered visibility detection using Intersection Observer API.

```tsx
import { useInView } from "@/hooks/useInView";

function Component() {
  const [ref, isInView] = useInView({ threshold: 0.1, triggerOnce: true });
  
  return (
    <div
      ref={ref}
      className={isInView ? "animate-fade-slide-up" : "opacity-0"}
    >
      Content reveals when scrolled into view
    </div>
  );
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `threshold` | `number` | `0.1` | Visibility percentage to trigger (0-1) |
| `rootMargin` | `string` | `"0px"` | Margin around root element |
| `triggerOnce` | `boolean` | `true` | Only trigger once (don't reset) |

**Returns**: `[RefObject<T>, boolean]` - ref to attach, isInView state

### useMobile (`use-mobile.ts`)
Detect mobile viewport for responsive behavior.

```tsx
import { useMobile } from "@/hooks/use-mobile";

function Component() {
  const isMobile = useMobile();
  
  return isMobile ? <MobileView /> : <DesktopView />;
}
```

## Animation Patterns

### Staggered Reveal
```tsx
const [ref, isInView] = useInView();

<div ref={ref}>
  <h2 className={isInView ? "animate-fade-slide-up" : "opacity-0"}>Title</h2>
  <p className={isInView ? "animate-fade-slide-up animate-stagger-1" : "opacity-0"}>
    Paragraph with 100ms delay
  </p>
  <button className={isInView ? "animate-fade-slide-up animate-stagger-2" : "opacity-0"}>
    Button with 200ms delay
  </button>
</div>
```

### Card Grid Reveal
```tsx
const [ref, isInView] = useInView();

<div ref={ref} className="grid grid-cols-3 gap-4">
  {items.map((item, index) => (
    <Card
      key={item.id}
      className={cn(
        isInView ? "animate-fade-slide-up" : "opacity-0",
        isInView && `animate-stagger-${Math.min(index + 1, 6)}`
      )}
    />
  ))}
</div>
```

## Available Animation Classes
Defined in `app/globals.css`:

| Class | Effect |
|-------|--------|
| `animate-fade-slide-up` | Fade in + slide up 30px |
| `animate-fade-slide-down` | Fade in + slide down 30px |
| `animate-scale-in` | Scale from 0.95 to 1 + fade |
| `animate-slide-in-left` | Slide in from left 20px |
| `animate-stagger-1` to `-6` | Delay 100-600ms |
| `btn-hover-lift` | Button hover: lift + shadow |
| `card-hover-lift` | Card hover: lift + shadow |
| `img-hover-zoom` | Image hover: scale 1.05 |

## JIT Index
```bash
# Find hook usage
rg -n "useInView|useMobile" app/ components/

# Find animation classes
rg -n "animate-fade|animate-scale|animate-stagger" app/ components/
```

## Common Gotchas
- Hooks require `"use client"` in consuming component
- `useInView` returns ref that MUST be attached to a DOM element
- `triggerOnce: true` (default) means animation won't replay on scroll
- Animation classes need initial `opacity-0` state before `isInView` is true
- Stagger classes max out at `-6` (600ms) - use custom delays for more
