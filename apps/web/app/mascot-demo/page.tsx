'use client';

import React, { useState } from 'react';
import {
  Rabbit,
  RabbitPose,
  RabbitLoader,
  TransactionLoader,
  RabbitEmptyState,
  NoPoolsEmptyState,
  CornerRabbit,
  useRabbitTransaction,
} from '@/components/mascot';
import styles from './page.module.css';

export default function MascotDemoPage() {
  const [selectedPose, setSelectedPose] = useState<RabbitPose>('idle');
  const [showLoader, setShowLoader] = useState(false);
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const { pose: txPose, onPending, onSuccess, onError } = useRabbitTransaction();

  const poses: RabbitPose[] = [
    'idle',
    'hopping',
    'victory',
    'error',
    'thinking',
    'sleeping',
    'waving',
    'excited',
  ];

  return (
    <div className={styles.demoPage}>
      <div className={styles.header}>
        <h1>🐰 Warp Rabbit Mascot Demo</h1>
        <p>Your friendly mascot system for WarpX</p>
      </div>

      {/* Section 1: All Poses */}
      <section className={styles.section}>
        <h2>1. All Rabbit Poses</h2>
        <div className={styles.posesGrid}>
          {poses.map((pose) => (
            <div
              key={pose}
              className={styles.poseCard}
              onClick={() => setSelectedPose(pose)}
            >
              <Rabbit pose={pose} size={120} />
              <p className={styles.poseName}>{pose}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Interactive Pose Selector */}
      <section className={styles.section}>
        <h2>2. Interactive Pose Selector</h2>
        <div className={styles.interactiveDemo}>
          <div className={styles.bigRabbit}>
            <Rabbit pose={selectedPose} size={200} />
          </div>
          <div className={styles.controls}>
            <label>Select Pose:</label>
            <select
              value={selectedPose}
              onChange={(e) => setSelectedPose(e.target.value as RabbitPose)}
              className={styles.select}
            >
              {poses.map((pose) => (
                <option key={pose} value={pose}>
                  {pose}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section 3: Loading States */}
      <section className={styles.section}>
        <h2>3. Loading States</h2>
        <div className={styles.loadingDemo}>
          <div className={styles.loadingCard}>
            <h3>Basic Loader</h3>
            <RabbitLoader message="Loading pools..." size={100} />
          </div>
          <div className={styles.loadingCard}>
            <h3>No Progress Bar</h3>
            <RabbitLoader message="Fetching data..." showProgress={false} size={100} />
          </div>
        </div>

        <div className={styles.txDemo}>
          <h3>Transaction Status Loader</h3>
          <div className={styles.txControls}>
            <button onClick={() => setTxStatus('pending')} className={styles.btn}>
              Pending
            </button>
            <button onClick={() => setTxStatus('success')} className={styles.btn}>
              Success
            </button>
            <button onClick={() => setTxStatus('error')} className={styles.btn}>
              Error
            </button>
          </div>
          <TransactionLoader status={txStatus} size={120} />
        </div>
      </section>

      {/* Section 4: Empty States */}
      <section className={styles.section}>
        <h2>4. Empty States</h2>
        <div className={styles.emptyDemo}>
          <div className={styles.emptyCard}>
            <RabbitEmptyState
              pose="thinking"
              title="Custom Empty State"
              description="This is a customizable empty state with any message you want!"
              size={140}
            />
          </div>
          <div className={styles.emptyCard}>
            <NoPoolsEmptyState onCreatePool={() => alert('Create pool clicked!')} />
          </div>
        </div>
      </section>

      {/* Section 5: Transaction Hook Demo */}
      <section className={styles.section}>
        <h2>5. Transaction Hook (useRabbitTransaction)</h2>
        <div className={styles.txHookDemo}>
          <Rabbit pose={txPose} size={150} />
          <div className={styles.txHookControls}>
            <button onClick={onPending} className={styles.btn}>
              Start Transaction
            </button>
            <button onClick={onSuccess} className={styles.btnSuccess}>
              Success
            </button>
            <button onClick={onError} className={styles.btnError}>
              Error
            </button>
          </div>
          <p className={styles.note}>
            The rabbit will automatically return to idle after success/error
          </p>
        </div>
      </section>

      {/* Section 6: Size Variations */}
      <section className={styles.section}>
        <h2>6. Size Variations</h2>
        <div className={styles.sizesDemo}>
          <div className={styles.sizeCard}>
            <Rabbit pose="waving" size={60} />
            <p>60px (Small)</p>
          </div>
          <div className={styles.sizeCard}>
            <Rabbit pose="waving" size={100} />
            <p>100px (Medium)</p>
          </div>
          <div className={styles.sizeCard}>
            <Rabbit pose="waving" size={150} />
            <p>150px (Large)</p>
          </div>
          <div className={styles.sizeCard}>
            <Rabbit pose="waving" size={220} />
            <p>220px (XL)</p>
          </div>
        </div>
      </section>

      {/* Section 7: Color System */}
      <section className={styles.section}>
        <h2>7. New Color System</h2>
        <div className={styles.colorGrid}>
          <div className={styles.colorCard} style={{ background: 'var(--speed-blue)' }}>
            <span>Speed Blue</span>
          </div>
          <div className={styles.colorCard} style={{ background: 'var(--neon-cyan)' }}>
            <span>Neon Cyan</span>
          </div>
          <div className={styles.colorCard} style={{ background: 'var(--carrot-orange)' }}>
            <span>Carrot Orange</span>
          </div>
          <div className={styles.colorCard} style={{ background: 'var(--neon-pink)' }}>
            <span>Neon Pink</span>
          </div>
          <div className={styles.colorCard} style={{ background: 'var(--deep-purple)' }}>
            <span>Deep Purple</span>
          </div>
        </div>

        <div className={styles.gradientGrid}>
          <div className={styles.gradientCard} style={{ background: 'var(--gradient-speed)' }}>
            <span>Speed Gradient</span>
          </div>
          <div className={styles.gradientCard} style={{ background: 'var(--gradient-energy)' }}>
            <span>Energy Gradient</span>
          </div>
          <div className={styles.gradientCard} style={{ background: 'var(--gradient-premium)' }}>
            <span>Premium Gradient</span>
          </div>
        </div>
      </section>

      {/* Corner Rabbit (always visible) */}
      <CornerRabbit
        position="bottom-right"
        size={80}
        enableEasterEggs={true}
        facts={[
          "This is a demo page! 🎨",
          "Click me for fun facts!",
          "I'm customizable! 🐰",
          "MegaETH = Mega Fast! ⚡",
          "Check out the README!",
        ]}
      />

      <div className={styles.footer}>
        <p>
          <strong>Note:</strong> The corner rabbit (bottom-right) is interactive! Click it for fun
          facts.
        </p>
        <p>Check the README.md in /components/mascot for full documentation.</p>
      </div>
    </div>
  );
}
