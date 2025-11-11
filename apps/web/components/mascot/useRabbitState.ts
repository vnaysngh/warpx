'use client';

import { useState, useEffect } from 'react';
import type { RabbitPose } from './Rabbit';

interface UseRabbitStateOptions {
  idleAfter?: number; // ms to wait before returning to idle
  randomIdle?: boolean; // randomly switch between idle poses
}

export function useRabbitState(options: UseRabbitStateOptions = {}) {
  const { idleAfter = 3000, randomIdle = false } = options;
  const [pose, setPose] = useState<RabbitPose>('idle');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (pose === 'idle' || !idleAfter) return;

    const timer = setTimeout(() => {
      if (randomIdle && Math.random() > 0.5) {
        setPose('waving');
        setTimeout(() => setPose('idle'), 1000);
      } else {
        setPose('idle');
      }
      setIsAnimating(false);
    }, idleAfter);

    return () => clearTimeout(timer);
  }, [pose, idleAfter, randomIdle]);

  const changePose = (newPose: RabbitPose, duration?: number) => {
    setPose(newPose);
    setIsAnimating(true);

    if (duration) {
      setTimeout(() => {
        setPose('idle');
        setIsAnimating(false);
      }, duration);
    }
  };

  return {
    pose,
    changePose,
    isAnimating,
  };
}

// Hook for loading states
export function useRabbitLoader(isLoading: boolean) {
  const [pose, setPose] = useState<RabbitPose>('idle');

  useEffect(() => {
    setPose(isLoading ? 'hopping' : 'idle');
  }, [isLoading]);

  return pose;
}

// Hook for transaction states
export function useRabbitTransaction() {
  const [pose, setPose] = useState<RabbitPose>('idle');

  const onPending = () => setPose('hopping');
  const onSuccess = () => {
    setPose('victory');
    setTimeout(() => setPose('idle'), 2000);
  };
  const onError = () => {
    setPose('error');
    setTimeout(() => setPose('idle'), 3000);
  };
  const onThinking = () => setPose('thinking');

  return {
    pose,
    onPending,
    onSuccess,
    onError,
    onThinking,
  };
}

// Hook for interactive rabbit (responds to user actions)
export function useInteractiveRabbit() {
  const [pose, setPose] = useState<RabbitPose>('idle');
  const [clickCount, setClickCount] = useState(0);

  const onClick = () => {
    setClickCount((prev) => prev + 1);

    // Different reactions based on click count
    if (clickCount % 5 === 0) {
      setPose('excited');
    } else if (clickCount % 3 === 0) {
      setPose('victory');
    } else {
      setPose('waving');
    }

    setTimeout(() => setPose('idle'), 1500);
  };

  const onHover = () => {
    if (pose === 'idle') {
      setPose('waving');
      setTimeout(() => setPose('idle'), 1000);
    }
  };

  return {
    pose,
    onClick,
    onHover,
    clickCount,
  };
}
