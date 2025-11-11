'use client';

import React, { useState, useEffect } from 'react';
import { Rabbit, RabbitPose } from './Rabbit';
import { useInteractiveRabbit } from './useRabbitState';
import styles from './CornerRabbit.module.css';

interface CornerRabbitProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: number;
  enableEasterEggs?: boolean;
  facts?: string[];
}

const DEFAULT_FACTS = [
  "MegaETH is super fast! ⚡",
  "Rabbits can hop up to 3 feet high!",
  "Always DYOR before trading!",
  "Liquidity pools = faster swaps!",
  "I run on warp speed! 🚀",
  "Check the price impact!",
  "Gas fees on MegaETH are tiny!",
  "Hop responsibly! 🐰",
];

export function CornerRabbit({
  position = 'bottom-right',
  size = 80,
  enableEasterEggs = true,
  facts = DEFAULT_FACTS
}: CornerRabbitProps) {
  const { pose, onClick, onHover } = useInteractiveRabbit();
  const [showFact, setShowFact] = useState(false);
  const [currentFact, setCurrentFact] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  const handleClick = () => {
    if (!enableEasterEggs) return;

    onClick();

    // Show random fact
    const randomFact = facts[Math.floor(Math.random() * facts.length)];
    setCurrentFact(randomFact);
    setShowFact(true);

    setTimeout(() => {
      setShowFact(false);
    }, 3000);
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  };

  return (
    <div className={`${styles.cornerRabbit} ${styles[position]}`}>
      {/* Speech bubble with fact */}
      {showFact && !isMinimized && (
        <div className={styles.speechBubble}>
          <p>{currentFact}</p>
          <div className={styles.bubbleTail} />
        </div>
      )}

      {/* Rabbit container */}
      <div
        className={`${styles.rabbitContainer} ${isMinimized ? styles.minimized : ''}`}
        onClick={handleClick}
        onMouseEnter={onHover}
        role="button"
        tabIndex={0}
        aria-label="Interactive mascot - click for fun facts!"
      >
        <Rabbit pose={isMinimized ? 'sleeping' : pose} size={size} />

        {/* Minimize button */}
        <button
          className={styles.minimizeButton}
          onClick={handleMinimize}
          aria-label={isMinimized ? 'Show mascot' : 'Hide mascot'}
        >
          {isMinimized ? '👀' : '−'}
        </button>
      </div>

      {/* Interaction hint */}
      {!showFact && !isMinimized && (
        <div className={styles.hint}>Click me!</div>
      )}
    </div>
  );
}

// Hook to control corner rabbit from anywhere in the app
export function useCornerRabbit() {
  const [globalPose, setGlobalPose] = useState<RabbitPose>('idle');

  useEffect(() => {
    // Listen for custom events
    const handlePoseChange = (e: CustomEvent<{ pose: RabbitPose }>) => {
      setGlobalPose(e.detail.pose);
    };

    window.addEventListener('rabbit:pose' as any, handlePoseChange);

    return () => {
      window.removeEventListener('rabbit:pose' as any, handlePoseChange);
    };
  }, []);

  const changePose = (pose: RabbitPose) => {
    const event = new CustomEvent('rabbit:pose', { detail: { pose } });
    window.dispatchEvent(event);
  };

  return { globalPose, changePose };
}
