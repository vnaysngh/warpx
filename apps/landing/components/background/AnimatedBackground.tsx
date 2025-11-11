'use client';

import React from 'react';
import styles from './AnimatedBackground.module.css';

interface AnimatedBackgroundProps {
  variant?: 'landing' | 'hero';
}

const PARTICLE_COUNT = 20;

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const format = (value: number, unit: string) => `${value.toFixed(3)}${unit}`;

const generateParticles = (variant: AnimatedBackgroundProps['variant'] = 'landing') =>
  Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const left = seededRandom(hashString(`${variant}-left-${i}`)) * 100;
    const top = seededRandom(hashString(`${variant}-top-${i}`)) * 100;
    const delay = seededRandom(hashString(`${variant}-delay-${i}`)) * 10;
    const duration = 15 + seededRandom(hashString(`${variant}-duration-${i}`)) * 10;

    return {
      left: format(left, '%'),
      top: format(top, '%'),
      animationDelay: format(delay, 's'),
      animationDuration: format(duration, 's'),
    };
  });

export function AnimatedBackground({ variant = 'landing' }: AnimatedBackgroundProps) {
  const particles = React.useMemo(() => generateParticles(variant), [variant]);

  return (
    <div className={styles.backgroundContainer}>
      {/* Large gradient orbs */}
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />
      <div className={`${styles.orb} ${styles.orb4}`} />
      <div className={`${styles.orb} ${styles.orb5}`} />

      {/* Floating particles */}
      <div className={styles.particlesContainer}>
        {particles.map((particle, i) => (
          <div
            key={i}
            className={styles.particle}
            style={particle}
          />
        ))}
      </div>

      {/* Grid overlay */}
      <div className={styles.gridOverlay} />

      {/* Gradient mesh */}
      <div className={styles.gradientMesh}>
        <div className={styles.meshGradient1} />
        <div className={styles.meshGradient2} />
        <div className={styles.meshGradient3} />
      </div>

      {/* Floating shapes */}
      <div className={styles.floatingShapes}>
        <div className={`${styles.shape} ${styles.shape1}`} />
        <div className={`${styles.shape} ${styles.shape2}`} />
        <div className={`${styles.shape} ${styles.shape3}`} />
        <div className={`${styles.shape} ${styles.shape4}`} />
      </div>
    </div>
  );
}
