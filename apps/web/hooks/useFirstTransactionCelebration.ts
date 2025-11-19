import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";

const CELEBRATION_KEY = "warpx_first_tx_celebrated";

/**
 * Hook to handle first transaction celebration with confetti animation
 * Checks localStorage to ensure celebration only shows once per user
 */
export function useFirstTransactionCelebration() {
  const [hasCelebrated, setHasCelebrated] = useState(true); // Default to true to avoid flash

  useEffect(() => {
    // Check localStorage on mount
    const celebrated = localStorage.getItem(CELEBRATION_KEY);
    setHasCelebrated(celebrated === "true");
  }, []);

  const celebrate = useCallback(() => {
    // Only celebrate if we haven't before
    if (hasCelebrated) {
      return;
    }

    // Mark as celebrated in localStorage
    localStorage.setItem(CELEBRATION_KEY, "true");
    setHasCelebrated(true);

    // Fire confetti from both sides
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: NodeJS.Timeout = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Fire from left
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });

      // Fire from right
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  }, [hasCelebrated]);

  return {
    shouldCelebrate: !hasCelebrated,
    celebrate
  };
}
