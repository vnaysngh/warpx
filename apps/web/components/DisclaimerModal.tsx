"use client";

import { useState } from "react";
import styles from "@/app/page.module.css";

const DISCLAIMER_KEY = "warpx-disclaimer-accepted";

export function DisclaimerModal() {
  // Lazy initialize state from localStorage to avoid effect
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const hasAccepted = localStorage.getItem(DISCLAIMER_KEY);
    return !hasAccepted;
  });

  const handleAccept = () => {
    localStorage.setItem(DISCLAIMER_KEY, "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.disclaimerModal}>
        <div className={styles.disclaimerHeader}>
          <h2 className={styles.disclaimerTitle}>Welcome to WarpX</h2>
        </div>

        <div className={styles.disclaimerContent}>
          <p>
            WarpX is a new decentralized exchange built on the MegaETH Testnet.
          </p>

          <p>
            As we&apos;re in the early stages, your feedback is invaluable to
            us. We&apos;re actively collecting insights from our community to
            improve the platform.
          </p>

          <p>
            Early contributors and testers will be recognized for their
            participation in shaping WarpX.
          </p>

          <p>
            Please note: This is a testnet deployment. Use test tokens only.
          </p>
        </div>

        <button
          className={styles.disclaimerButton}
          onClick={handleAccept}
          type="button"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}
