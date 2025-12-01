# Animation Best Practices - Kalanara Spa

> Reference guide untuk implementasi UI animations yang purposeful dan memorable.

---

## Core Philosophy

**"You don't need animations everywhere"** - Focus pada key moments yang enhance user experience:

| Priority | Area | Purpose |
|----------|------|---------|
| 1 | Hero Intro | First impression, brand personality |
| 2 | Hover Interactions | Feedback, discoverability |
| 3 | Content Reveal | Guide attention, reduce cognitive load |
| 4 | Background Effects | Atmosphere, depth |
| 5 | Navigation Transitions | Spatial awareness, continuity |

---

## Animation Patterns

### 1. Intro + Scroll Reveal

**Best Practice:**
```css
/* Use 'both' instead of 'forwards' for cleaner animation fill */
animation: fadeSlideIn 0.6s ease-out both;

/* Avoid opacity: 0 as initial state - use transforms instead */
@keyframes fadeSlideIn {
  from {
    opacity: 0.01; /* Not 0 - prevents layout issues */
    transform: translateY(20px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}
```

**Element-by-element stagger:**
```tsx
// Stagger children dengan animation-delay
{items.map((item, i) => (
  <div 
    key={item.id}
    style={{ animationDelay: `${i * 100}ms` }}
    className="animate-fadeSlideIn"
  >
    {item.content}
  </div>
))}
```

**Clip-path reveal (column by column):**
```css
@keyframes clipReveal {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
```

---

### 2. Button Animations

**Border beam effect (hover):**
```css
.btn-beam {
  position: relative;
  overflow: hidden;
}

.btn-beam::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid transparent;
  border-radius: inherit;
  background: linear-gradient(90deg, transparent, var(--accent), transparent) border-box;
  mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.3s;
}

.btn-beam:hover::before {
  opacity: 1;
  animation: beamRotate 2s linear infinite;
}

@keyframes beamRotate {
  to { transform: rotate(360deg); }
}
```

**Scale + shadow lift:**
```css
.btn-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-hover:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 10px 30px -10px rgba(0,0,0,0.2);
}
```

---

### 3. Text Animations

**Vertical clip slide (letter by letter):**
```css
.text-reveal {
  overflow: hidden;
}

.text-reveal span {
  display: inline-block;
  animation: slideDown 0.5s ease-out both;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    clip-path: inset(0 0 100% 0);
  }
  to {
    transform: translateY(0);
    clip-path: inset(0 0 0 0);
  }
}
```

**Implementation (React):**
```tsx
const AnimatedText = ({ text }: { text: string }) => (
  <span className="text-reveal">
    {text.split('').map((char, i) => (
      <span key={i} style={{ animationDelay: `${i * 50}ms` }}>
        {char === ' ' ? '\u00A0' : char}
      </span>
    ))}
  </span>
);
```

---

### 4. Marquee / Infinite Loop

**Logos atau testimonials looping:**
```css
.marquee-container {
  overflow: hidden;
  mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 10%,
    black 90%,
    transparent 100%
  );
}

.marquee-track {
  display: flex;
  gap: 2rem;
  animation: marquee 30s linear infinite;
}

@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
```

**HTML structure:**
```html
<div class="marquee-container">
  <div class="marquee-track">
    <!-- Duplicate content for seamless loop -->
    <div class="marquee-content">...</div>
    <div class="marquee-content">...</div>
  </div>
</div>
```

---

### 5. Content Switching / Carousel

**Rotate between cards:**
```tsx
const [activeIndex, setActiveIndex] = useState(0);

// Auto-rotate
useEffect(() => {
  const interval = setInterval(() => {
    setActiveIndex((prev) => (prev + 1) % cards.length);
  }, 5000);
  return () => clearInterval(interval);
}, []);

// Card animation
<div className={cn(
  "transition-all duration-500",
  isActive ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0"
)}>
```

---

### 6. Flashlight / Spotlight Effect

**Mouse-tracking glow:**
```tsx
const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

const handleMouseMove = (e: React.MouseEvent) => {
  const rect = e.currentTarget.getBoundingClientRect();
  setMousePos({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  });
};

<div 
  onMouseMove={handleMouseMove}
  style={{
    background: `radial-gradient(
      300px circle at ${mousePos.x}px ${mousePos.y}px,
      rgba(255,255,255,0.06),
      transparent
    )`
  }}
/>
```

**Border glow on hover:**
```css
.card-glow {
  position: relative;
}

.card-glow::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: radial-gradient(
    var(--glow-size, 200px) circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    var(--accent),
    transparent
  );
  opacity: 0;
  transition: opacity 0.3s;
  z-index: -1;
}

.card-glow:hover::before {
  opacity: 0.5;
}
```

---

## Kalanara Spa - Implementation Priorities

### Phase 1: Quick Wins (Current Sprint)

| Component | Animation | Effort |
|-----------|-----------|--------|
| Hero Section | Staggered fade-in untuk heading, subtext, CTA | Low |
| Service Cards | Hover lift + shadow | Low |
| Trust Features | Fade-in on scroll | Low |
| Navbar | Smooth scroll-based color transition | Done ✓ |

### Phase 2: Enhancement

| Component | Animation | Effort |
|-----------|-----------|--------|
| Hero Background | Subtle parallax atau ken burns | Medium |
| Service Cards | Image zoom on hover | Low |
| Reviews Section | Auto-rotate testimonials | Medium |
| CTA Buttons | Border beam on hover | Medium |

### Phase 3: Polish

| Component | Animation | Effort |
|-----------|-----------|--------|
| Logo/Partners | Marquee infinite loop | Medium |
| Cards | Flashlight effect on hover | High |
| Hero Text | Letter-by-letter reveal | High |
| Page Transitions | Clip-path reveals | High |

---

## Technical Guidelines

### Performance

```tsx
// ✅ DO: Use CSS transforms and opacity
transform: translateY(20px);
opacity: 0.5;

// ❌ DON'T: Animate layout properties
margin-top: 20px;
height: 100px;
```

### Accessibility

```tsx
// Respect user preferences
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Tailwind Config Extension

```js
// tailwind.config.ts
theme: {
  extend: {
    animation: {
      'fade-in': 'fadeIn 0.5s ease-out both',
      'slide-up': 'slideUp 0.5s ease-out both',
      'blur-in': 'blurIn 0.5s ease-out both',
      'marquee': 'marquee 30s linear infinite',
    },
    keyframes: {
      fadeIn: {
        from: { opacity: '0' },
        to: { opacity: '1' },
      },
      slideUp: {
        from: { transform: 'translateY(20px)', opacity: '0' },
        to: { transform: 'translateY(0)', opacity: '1' },
      },
      blurIn: {
        from: { filter: 'blur(4px)', opacity: '0' },
        to: { filter: 'blur(0)', opacity: '1' },
      },
      marquee: {
        from: { transform: 'translateX(0)' },
        to: { transform: 'translateX(-50%)' },
      },
    },
  },
},
```

---

## Prompting Tips (untuk AI-assisted animation)

Saat request animasi ke AI, sertakan:

1. **Context**: Komponen apa, di mana posisinya
2. **Trigger**: Kapan animasi jalan (load, scroll, hover)
3. **Style reference**: Link atau deskripsi visual
4. **Technical constraint**: Framework, library yang dipakai

**Example prompts:**

```
"Animate when in view: fade in, slide in, blur in, element by element. 
Use 'both' instead of 'forwards'. Don't use opacity 0."

"Add a 1px border beam animation around the pill-shaped button on hover."

"Add a marquis infinite loop slow animation to the logos using alpha mask"

"Add a subtle flashlight effect on hover/mouse position to both 
background and border of the cards."
```

---

## Resources

- [Framer Motion](https://www.framer.com/motion/) - React animation library
- [GSAP](https://greensock.com/gsap/) - Professional-grade animations
- [Lottie](https://lottiefiles.com/) - JSON-based animations
- [CSS Tricks - Animation Guide](https://css-tricks.com/almanac/properties/a/animation/)

---

*Last updated: 2025-11-29*
