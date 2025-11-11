'use client';

import React from 'react';
import { Rabbit } from './Rabbit';
import styles from './Rabbit.module.css';

interface RabbitLoaderProps {
  message?: string;
  size?: number;
  showProgress?: boolean;
}

export function RabbitLoader({
  message = 'Loading...',
  size = 100,
  showProgress = true
}: RabbitLoaderProps) {
  return (
    <div className={styles.rabbitContainer}>
      <div style={{ textAlign: 'center' }}>
        <Rabbit pose="hopping" size={size} />
        {showProgress && <div className={styles.rabbitLoadingBar} />}
        {message && (
          <p
            style={{
              marginTop: 16,
              color: 'var(--fg-subtle)',
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

interface TransactionLoaderProps {
  status: 'pending' | 'success' | 'error';
  message?: string;
  size?: number;
}

export function TransactionLoader({
  status,
  message,
  size = 120
}: TransactionLoaderProps) {
  const getPose = () => {
    switch (status) {
      case 'pending':
        return 'hopping';
      case 'success':
        return 'victory';
      case 'error':
        return 'error';
      default:
        return 'idle';
    }
  };

  const getDefaultMessage = () => {
    switch (status) {
      case 'pending':
        return 'Hopping to the blockchain...';
      case 'success':
        return 'Success! Transaction complete!';
      case 'error':
        return 'Oops! Something went wrong';
      default:
        return '';
    }
  };

  const getColor = () => {
    switch (status) {
      case 'pending':
        return 'var(--speed-blue)';
      case 'success':
        return 'var(--neon-cyan)';
      case 'error':
        return 'var(--error)';
      default:
        return 'var(--fg-subtle)';
    }
  };

  return (
    <div className={styles.rabbitContainer}>
      <div style={{ textAlign: 'center' }}>
        <Rabbit pose={getPose()} size={size} />
        {status === 'pending' && <div className={styles.rabbitLoadingBar} />}
        <p
          style={{
            marginTop: 16,
            color: getColor(),
            fontSize: 16,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {message || getDefaultMessage()}
        </p>
      </div>
    </div>
  );
}
