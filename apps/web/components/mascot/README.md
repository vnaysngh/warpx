# 🐰 Warp Rabbit Mascot System

Your friendly, animated rabbit mascot for WarpX! Built to bring personality, engagement, and modern vibes to your AMM.

## 📦 Components Overview

### 1. **Rabbit** - Base Mascot Component
The core SVG rabbit with 8 different poses.

```tsx
import { Rabbit } from '@/components/mascot';

// Basic usage
<Rabbit pose="idle" size={120} />

// Available poses:
// - idle: Default resting state
// - hopping: Loading/in-progress
// - victory: Success states
// - error: Error states
// - thinking: Empty states / pondering
// - sleeping: No activity
// - waving: Greetings
// - excited: High energy moments
```

### 2. **RabbitLoader** - Loading States
Animated loading indicator with rabbit.

```tsx
import { RabbitLoader, TransactionLoader } from '@/components/mascot';

// Simple loader
<RabbitLoader message="Loading pools..." size={100} />

// Transaction-specific loader
<TransactionLoader
  status="pending" // 'pending' | 'success' | 'error'
  message="Swapping tokens..."
  size={120}
/>
```

### 3. **RabbitEmptyState** - Empty States
Beautiful empty state with rabbit and CTA.

```tsx
import {
  RabbitEmptyState,
  NoPoolsEmptyState,
  WalletNotConnectedEmptyState
} from '@/components/mascot';

// Custom empty state
<RabbitEmptyState
  pose="thinking"
  title="No Results Found"
  description="Try adjusting your filters"
  action={<button>Clear Filters</button>}
/>

// Pre-built empty states
<NoPoolsEmptyState onCreatePool={() => router.push('/pools/create')} />
<WalletNotConnectedEmptyState onConnect={connectWallet} />
```

### 4. **CornerRabbit** - Interactive Mascot
Floating mascot in corner with Easter eggs.

```tsx
import { CornerRabbit } from '@/components/mascot';

// Add to your layout
<CornerRabbit
  position="bottom-right"
  size={80}
  enableEasterEggs={true}
  facts={[
    "MegaETH is lightning fast! ⚡",
    "Always check price impact!",
    "Liquidity = Better prices!"
  ]}
/>
```

## 🎣 Hooks

### useRabbitState
Manage rabbit pose with auto-reset.

```tsx
import { useRabbitState } from '@/components/mascot';

function MyComponent() {
  const { pose, changePose } = useRabbitState({
    idleAfter: 3000, // Return to idle after 3s
    randomIdle: true // Randomly wave sometimes
  });

  return (
    <div>
      <Rabbit pose={pose} />
      <button onClick={() => changePose('excited', 2000)}>
        Celebrate!
      </button>
    </div>
  );
}
```

### useRabbitTransaction
React to transaction states.

```tsx
import { useRabbitTransaction } from '@/components/mascot';

function SwapButton() {
  const { pose, onPending, onSuccess, onError } = useRabbitTransaction();

  const handleSwap = async () => {
    onPending();
    try {
      await executeSwap();
      onSuccess(); // Shows victory pose for 2s
    } catch (error) {
      onError(); // Shows error pose for 3s
    }
  };

  return <Rabbit pose={pose} />;
}
```

### useCornerRabbit
Control corner mascot from anywhere.

```tsx
import { useCornerRabbit } from '@/components/mascot';

function AnyComponent() {
  const { changePose } = useCornerRabbit();

  const celebrate = () => {
    changePose('victory'); // Corner rabbit celebrates!
  };

  return <button onClick={celebrate}>Win!</button>;
}
```

## 🎨 Integration Examples

### Example 1: Swap Page
```tsx
'use client';

import { useState } from 'react';
import { Rabbit, useRabbitTransaction } from '@/components/mascot';

export function SwapCard() {
  const { pose, onPending, onSuccess, onError } = useRabbitTransaction();
  const [isSwapping, setIsSwapping] = useState(false);

  const handleSwap = async () => {
    setIsSwapping(true);
    onPending();

    try {
      await swapTokens();
      onSuccess();
      toast.success('Swap successful!');
    } catch (error) {
      onError();
      toast.error('Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className={styles.swapCard}>
      {/* Your swap UI */}

      {isSwapping && (
        <div className={styles.overlay}>
          <Rabbit pose={pose} size={150} />
          <p>Hopping to the blockchain...</p>
        </div>
      )}

      <button onClick={handleSwap}>Swap</button>
    </div>
  );
}
```

### Example 2: Pools Page with Empty State
```tsx
import { NoPoolsEmptyState } from '@/components/mascot';

export function PoolsPage({ pools }) {
  if (!pools.length) {
    return <NoPoolsEmptyState onCreatePool={() => router.push('/create')} />;
  }

  return <PoolsTable pools={pools} />;
}
```

### Example 3: Global Layout with Corner Mascot
```tsx
import { CornerRabbit } from '@/components/mascot';

export function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <CornerRabbit
          position="bottom-right"
          facts={[
            "MegaETH = Mega Fast! ⚡",
            "Check out our docs!",
            "Join our community! 🐰"
          ]}
        />
      </body>
    </html>
  );
}
```

## 🎬 Animation Features

All animations are automatically applied via CSS modules:

- **Idle**: Gentle breathing
- **Hopping**: Continuous bounce with speed lines
- **Victory**: Bounce with confetti
- **Error**: Shake with spinning stars
- **Thinking**: Gentle tilt with floating thought bubble
- **Sleeping**: Slow breathing with floating Z's
- **Waving**: Arm wave animation
- **Excited**: Intense bounce with sparkles

### Accessibility
All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  /* All animations disabled */
}
```

## 🎨 Customization

### Custom Colors
All colors use CSS variables from `globals.css`:

```css
/* Override in your component */
.customRabbit {
  --speed-blue: #YOUR_COLOR;
  --neon-cyan: #YOUR_COLOR;
  --carrot-orange: #YOUR_COLOR;
}
```

### Custom Poses
Extend the Rabbit component:

```tsx
// In Rabbit.tsx, add your pose function:
function CustomPose() {
  return (
    <g className="rabbit-custom">
      {/* Your SVG elements */}
    </g>
  );
}
```

## 🚀 Performance

- **Bundle Size**: ~15KB (gzipped with all components)
- **SVG-based**: Infinitely scalable, no image assets
- **CSS Animations**: GPU-accelerated transforms
- **Zero Dependencies**: Pure React + CSS

## 📱 Responsive Design

All components are fully responsive:
- Mobile-optimized sizes
- Touch-friendly interactions
- Adaptive layouts

## 🎉 Easter Eggs

The CornerRabbit includes fun interactions:
- Click for random facts
- Hover for wave
- Different reactions based on click count
- Can be minimized

## 🔧 Advanced Usage

### Global Event System
Control mascot from anywhere:

```tsx
// Dispatch global pose change
const event = new CustomEvent('rabbit:pose', {
  detail: { pose: 'victory' }
});
window.dispatchEvent(event);
```

### Conditional Rendering
Show mascot based on context:

```tsx
import { useEffect } from 'react';
import { useCornerRabbit } from '@/components/mascot';

function TransactionMonitor() {
  const { changePose } = useCornerRabbit();

  useEffect(() => {
    const subscription = watchTransactions((tx) => {
      if (tx.status === 'success') changePose('victory');
      if (tx.status === 'failed') changePose('error');
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
```

## 🎯 Best Practices

1. **Use appropriate poses**
   - `hopping` for loading (< 5s expected)
   - `thinking` for empty states
   - `victory` for success moments
   - `error` for failures

2. **Size guidelines**
   - Corner mascot: 60-80px
   - Loading states: 100-120px
   - Empty states: 140-180px
   - Hero sections: 200px+

3. **Message guidelines**
   - Keep messages short and friendly
   - Use "Hopping..." for blockchain actions
   - Add personality but stay clear

4. **Performance**
   - Limit to 1-2 animated rabbits per view
   - Use CSS transforms only for animations
   - Respect prefers-reduced-motion

## 🐛 Troubleshooting

**Rabbit not animating?**
- Check CSS module is imported
- Verify pose name is correct
- Check browser supports CSS animations

**Colors not showing?**
- Ensure globals.css is loaded
- Check CSS variable names match
- Verify no CSS conflicts

**Corner mascot not appearing?**
- Check z-index conflicts
- Verify position isn't off-screen
- Check if minimized on mobile

## 📚 Additional Resources

- See `/components/mascot/*.tsx` for implementation
- Check `Rabbit.module.css` for animation keyframes
- Review `globals.css` for color variables

---

**Made with 💙 for WarpX on MegaETH**

Hop into the future of trading! 🐰⚡
