'use client';

import React from 'react';
import { Rabbit, RabbitPose } from './Rabbit';
import styles from './RabbitEmptyState.module.css';

interface RabbitEmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  pose?: RabbitPose;
  size?: number;
}

export function RabbitEmptyState({
  title,
  description,
  action,
  pose = 'thinking',
  size = 150
}: RabbitEmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.rabbitWrapper}>
        <Rabbit pose={pose} size={size} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

// Preset empty states for common scenarios
export function NoPoolsEmptyState({ onCreatePool }: { onCreatePool?: () => void }) {
  return (
    <RabbitEmptyState
      pose="thinking"
      title="No Liquidity Pools Yet"
      description="Be the first to hop in and create a liquidity pool!"
      action={
        onCreatePool ? (
          <button className={styles.actionButton} onClick={onCreatePool}>
            Create Pool
          </button>
        ) : null
      }
    />
  );
}

export function NoPositionsEmptyState() {
  return (
    <RabbitEmptyState
      pose="sleeping"
      title="No Active Positions"
      description="Your liquidity positions will appear here once you add liquidity to a pool."
    />
  );
}

export function NoTradesEmptyState() {
  return (
    <RabbitEmptyState
      pose="excited"
      title="Ready to Warp Speed?"
      description="Make your first swap at lightning speed on MegaETH!"
    />
  );
}

export function WalletNotConnectedEmptyState({ onConnect }: { onConnect?: () => void }) {
  return (
    <RabbitEmptyState
      pose="waving"
      title="Connect Your Wallet"
      description="Connect your wallet to start swapping at warp speed!"
      action={
        onConnect ? (
          <button className={styles.actionButton} onClick={onConnect}>
            Connect Wallet
          </button>
        ) : null
      }
    />
  );
}

export function NoStakingEmptyState() {
  return (
    <RabbitEmptyState
      pose="thinking"
      title="No Staking Positions"
      description="Stake your LP tokens to earn extra rewards!"
    />
  );
}

export function ErrorEmptyState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <RabbitEmptyState
      pose="error"
      title="Oops! Something Went Wrong"
      description={message || "Don't worry, even rabbits trip sometimes. Try again!"}
      action={
        onRetry ? (
          <button className={styles.actionButton} onClick={onRetry}>
            Try Again
          </button>
        ) : null
      }
    />
  );
}
