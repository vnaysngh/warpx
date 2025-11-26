# WarpX Design Guidelines

## Overview

WarpX is a modern, animation-heavy web3 AMM prototype built on the MegaETH blockchain. The design emphasizes real-time speed, low latency, and a smooth trading experience with a premium, technical aesthetic that feels like a professional trading terminal rather than a consumer application.

---

## Design Philosophy: Technical Precision

The design language mirrors high-performance trading terminals with:
- **Data Density**: Information-rich layouts optimized for power users
- **Mechanical Interactions**: Sharp, responsive UI elements with industrial aesthetics
- **Professional Tone**: Premium industrial cyber-noir aesthetic
- **Minimal Ornamentation**: Focus on function with carefully chosen visual effects

---

## Color System

### Primary Palette

```css
/* Subtle Pink Accent (Primary) */
--primary: 336 70% 65%; /* #EB6896 */

/* Deep Black Background */
--background: 0 0% 4%; /* #0a0a0a */

/* Foreground Text */
--foreground: 0 0% 95%; /* #F2F2F2 */

/* Card Backgrounds */
--card: 0 0% 7%; /* #121212 */

/* Secondary Backgrounds */
--secondary: 0 0% 12%; /* #1F1F1F */

/* Muted/Disabled */
--muted: 0 0% 12%; /* #1F1F1F */
--muted-foreground: 0 0% 60%; /* #999999 */

/* Cyan Accent (Secondary Stats) */
--accent: 180 90% 50%; /* #00E5FF */

/* Borders */
--border: 0 0% 16%; /* #2A2A2A */

/* Destructive/Error */
--destructive: 0 80% 50%; /* #FF4040 */
```

### Usage Guidelines

- **Primary Pink (#EB6896)**: Use for primary CTAs, active states, highlights, and accent indicators
- **Deep Black (#0a0a0a)**: Page background - creates contrast for all UI elements
- **Muted Gray (#1F1F1F)**: Secondary backgrounds, disabled states, and text
- **Borders (#2A2A2A)**: Subtle separation between elements without visual weight
- **Cyan (#00E5FF)**: Secondary statistics or alternative emphasis (use sparingly)
- **Red (#FF4040)**: Errors, destructive actions, and warnings

### Color Do's and Don'ts

✅ **Do:**
- Use pink for active states and primary interactions
- Layer multiple grays for depth and hierarchy
- Use cyan only for secondary information
- Maintain sufficient contrast (WCAG AA minimum)

❌ **Don't:**
- Use green accent colors (removed from design)
- Apply multiple accent colors to the same component
- Use bright colors for large background areas
- Reduce primary color saturation for disabled states

---

## Typography

### Font Stack

```css
/* Display / Headlines */
font-display: "Space Grotesk", sans-serif;
/* Usage: h1, h2, h3, section titles */

/* Body / UI Text */
font-sans: "Inter", sans-serif;
/* Usage: Labels, body text, descriptions */

/* Data / Numbers */
font-mono: "JetBrains Mono", monospace;
/* Usage: Prices, balances, transaction data, code */
```

### Heading Styles

All headings use:
- **Font Family**: Space Grotesk
- **Transform**: UPPERCASE
- **Letter Spacing**: 0.02em (wide tracking)
- **Weight**: Bold (700)

```css
h1 { font-size: 2rem; }      /* Pool Names, Page Titles */
h2 { font-size: 1.5rem; }    /* Section Headers */
h3 { font-size: 1.25rem; }   /* Subsection Headers */
```

### Body Text

- **Primary Body**: Inter, 14px, 0.95 opacity
- **Small/Secondary**: Inter, 12px, muted-foreground color
- **Mono Data**: JetBrains Mono, 14px, aligned right

### Usage Examples

```html
<!-- Heading -->
<h1 class="font-display font-bold text-4xl uppercase">ETH / USDC</h1>

<!-- Label -->
<span class="font-sans text-xs text-muted-foreground">PRICE</span>

<!-- Data Value -->
<span class="font-mono text-lg font-bold">$3,245.80</span>
```

---

## Border Radius & Corners

### Radius Scale

```css
--radius-sm: 2px;   /* Subtle curves */
--radius-md: 4px;   /* Standard components */
--radius-lg: 6px;   /* Larger elements */
--radius-xl: 8px;   /* Maximum curve */
```

### Corner Notches (Technical Detail)

All tech-cards feature optional corner notches on hover:
- **Position**: Top-left corner
- **Size**: 8px × 8px
- **Style**: 2px border in primary color
- **Animation**: Fade in on hover (0.2s)

```css
.tech-card::before {
  content: "";
  position: absolute;
  top: -1px;
  left: -1px;
  width: 8px;
  height: 8px;
  border-top: 2px solid hsl(var(--primary));
  border-left: 2px solid hsl(var(--primary));
  opacity: 0;
  transition: opacity 0.2s;
}

.tech-card:hover::before {
  opacity: 1;
}
```

---

## Spacing & Layout

### Spacing Scale

```css
/* Base Unit: 4px */
gap-1: 4px;
gap-2: 8px;
gap-3: 12px;
gap-4: 16px;
gap-6: 24px;
gap-8: 32px;
```

### Container Constraints

```css
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1rem;
}
```

### Grid System

- **Desktop (lg)**: 12-column grid with 32px gaps
- **Tablet (md)**: 6-column grid with 24px gaps
- **Mobile**: Single column with 16px gaps

### Padding Standards

- **Cards**: 24px (p-6)
- **Input/Button Height**: 56px (h-14, h-16)
- **Section Padding**: 48px (py-12)

---

## Component Patterns

### Input Fields

```html
<div className="relative">
  <input 
    className="h-16 bg-background border border-border rounded-none text-3xl font-mono focus-visible:ring-1 focus-visible:ring-primary/50 px-4"
    placeholder="0.00"
  />
  <!-- Optional: Token selector button on right -->
</div>
```

**Characteristics:**
- Height: 56-64px (h-14, h-16)
- Border: 1px solid (--border)
- Radius: None (rounded-none)
- Focus State: Pink ring (1px) at 50% opacity
- Text Alignment: Right for numbers, left for labels

### Buttons

```html
<!-- Primary Action -->
<button className="h-16 bg-primary text-black font-bold font-mono uppercase rounded-none hover:bg-primary/90 tracking-wider">
  Swap Assets
</button>

<!-- Secondary / Ghost -->
<button className="h-8 w-8 rounded-none hover:bg-white/5 text-muted-foreground">
  <Icon />
</button>
```

**Characteristics:**
- Heights: 32px (h-8), 56px (h-14), 64px (h-16)
- Border Radius: None (squared)
- Text: UPPERCASE, monospace, letter-spaced
- Hover: Brightness increase or border highlight
- Disabled: Reduced opacity (opacity-50)

### Cards

```html
<div className="bg-card border border-border p-6 rounded-none">
  <div className="text-xs font-mono text-muted-foreground">LABEL</div>
  <div className="text-2xl font-bold font-mono">$1,245.50</div>
</div>
```

**Characteristics:**
- Background: --card (0 0% 7%)
- Border: 1px solid --border
- Radius: None (squared)
- Padding: 24px standard
- Optional: Top accent bar (2-4px) in primary color

### Status Indicators

```html
<!-- Online Status -->
<div className="w-2 h-2 rounded-full bg-primary animate-pulse" />

<!-- Status Badge -->
<span className="text-xs bg-primary text-black px-2 py-0.5 font-mono font-bold rounded-sm">LIVE</span>
```

---

## Grid Background

The app features a technical grid overlay on chart containers:

```css
.grid-bg {
  background-size: 40px 40px;
  background-image: 
    linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
}
```

**Usage:**
- Applied to chart backgrounds
- Opacity: 50% (opacity-50)
- Creates technical, grid-like appearance

---

## Animation & Motion

### Framer Motion Defaults

```javascript
// Standard page transition
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.2 }}

// Staggered list items
transition={{ delay: i * 0.05 }}

// Smooth hover effects
transition-colors: 0.2s
transition-all: default
```

### Duration Standards

- **Quick**: 150ms (hover effects, focus states)
- **Standard**: 200-300ms (transitions, fades)
- **Deliberate**: 500-800ms (significant state changes)

### Interactive Elements

- **Hover State**: Border color shift to primary, slight brightness increase
- **Focus State**: Ring with primary color at reduced opacity
- **Active State**: Background color change, text color change
- **Disabled State**: Opacity reduction (50-60%)

---

## Navigation

### Top Bar

- **Height**: 64px (fixed)
- **Background**: Slightly elevated from main background
- **Sticky**: Remains at top on scroll
- **Content Alignment**: Left logo/title, right menu items
- **Mobile**: Drawer menu on hamburger click

### Breadcrumbs / Page Navigation

- **Font**: Monospace, 12px
- **Spacing**: Separated by " / "
- **Current Page**: Pink text (primary color)

### Responsive Behavior

- **Desktop (1024px+)**: Full navigation bar visible
- **Tablet (768px-1023px)**: Compact navigation
- **Mobile (<768px)**: Drawer menu with hamburger toggle

---

## Data Display

### Tables / Lists

```html
<div className="space-y-2">
  <div className="flex justify-between text-sm font-mono">
    <span className="text-muted-foreground">LABEL</span>
    <span>VALUE</span>
  </div>
  <!-- Repeated rows -->
</div>
```

**Characteristics:**
- Monospace font for alignment
- Muted gray labels on left
- Right-aligned values
- Small 12px font size
- Row spacing: 8px (gap-2)

### Charts

- **Chart Color**: Primary pink (#EB6896)
- **Grid Lines**: Subtle white at 3% opacity
- **Tooltip**: Dark background (#000) with 1px border
- **Animation Duration**: 300ms on data update

---

## Accessibility

### Contrast Requirements

- **Text on Background**: Minimum 4.5:1 contrast ratio (WCAG AA)
- **Interactive Elements**: Pink on dark background: ~5:1 ratio
- **Disabled State**: Reduce opacity to ~50%

### Focus States

All interactive elements must have visible focus indicators:

```css
focus-visible:ring-1 
focus-visible:ring-primary/50
```

### Test IDs

All interactive and data-displaying elements include `data-testid`:

```html
<!-- Interactive -->
<button data-testid="button-submit">Submit</button>
<input data-testid="input-email" />

<!-- Display -->
<span data-testid="text-username">{username}</span>
<div data-testid="card-pool-${poolId}" />

<!-- Dynamic Lists -->
<div data-testid="row-token-${index}" />
```

### Keyboard Navigation

- All buttons and links are keyboard accessible
- Tab order follows visual flow (left to right, top to bottom)
- Escape key closes modals
- Enter activates buttons

---

## Responsive Breakpoints

```css
/* Mobile First */
/* Default: Mobile (< 640px) */

@media (min-width: 768px) {
  /* Tablet: md */
}

@media (min-width: 1024px) {
  /* Desktop: lg */
}

@media (min-width: 1280px) {
  /* Wide: xl */
}
```

---

## Performance & Best Practices

### Animation Performance

- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, or `position`
- Use `transition-gpu` utilities when available
- Limit simultaneous animations to 3-4 elements

### Rendering Optimization

- Lazy-load off-screen content
- Use CSS Grid for complex layouts (better than flexbox for large layouts)
- Debounce resize handlers
- Memoize expensive computations

### Bundle Size

- Use tree-shaking for unused utilities
- Import only needed icons from lucide-react
- Split large components into lazy-loaded routes
- Compress SVG assets

---

## Implementation Checklist

When building new components, ensure:

- ✅ Uses correct font family (display/sans/mono)
- ✅ Follows color palette (no arbitrary colors)
- ✅ Border radius is 0 (rounded-none)
- ✅ Includes focus states (`focus-visible:ring`)
- ✅ Has appropriate `data-testid`
- ✅ Responsive on mobile/tablet/desktop
- ✅ Animation duration is 200-300ms (standard)
- ✅ Text is UPPERCASE for headings/labels
- ✅ Numbers use monospace font
- ✅ Hover states include border/color transitions

---

## Component Library

WarpX uses **Shadcn/UI** components with heavy customization:

- Buttons, Inputs, Cards (heavily styled)
- Dialog, Popover, Dropdown (functional UI)
- Tabs, Slider, Toggle (form controls)
- Toast, Tooltip (feedback components)

All base components are customized to match the Technical Precision theme (pink accents, no border radius, monospace labels).

---

## File References

- **Colors**: `client/src/index.css` (CSS variables in :root)
- **Typography**: `client/src/index.css` (font imports and @theme)
- **Components**: `client/src/components/`
- **Layouts**: `client/src/layouts/AppLayout.tsx`
- **Pages**: `client/src/pages/`

---

## Design Tokens Summary

| Token | Value | Usage |
|-------|-------|-------|
| Primary | #EB6896 | Buttons, highlights, active states |
| Background | #0a0a0a | Page background |
| Card | #121212 | Card backgrounds |
| Border | #2A2A2A | Element borders |
| Text | #F2F2F2 | Primary text |
| Muted | #1F1F1F / #999999 | Secondary text, disabled |
| Accent | #00E5FF | Secondary emphasis |
| Error | #FF4040 | Errors, destructive actions |
| Radius | 0px | All corners squared |
| Font Display | Space Grotesk | Headlines |
| Font Body | Inter | Body text |
| Font Mono | JetBrains Mono | Data/numbers |

---

**Last Updated**: November 26, 2025  
**Version**: 1.0  
**Status**: Active
