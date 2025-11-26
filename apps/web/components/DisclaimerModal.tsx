"use client";

import { useEffect, useState } from "react";

const DISCLAIMER_KEY = "warpx-disclaimer-accepted";

export function DisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const hasAccepted = localStorage.getItem(DISCLAIMER_KEY);
    if (!hasAccepted) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(DISCLAIMER_KEY, "true");
    setIsOpen(false);
  };

  if (!hasMounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background/90 px-4 py-10 backdrop-blur">
      <div className="tech-card w-full max-w-lg">
        <h2 className="font-display text-xl uppercase tracking-[0.35em]">
          Welcome to WarpX
        </h2>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <p>
            WarpX is a new decentralized exchange built on the MegaETH Testnet.
          </p>
          <p>
            As we&apos;re in the early stages, your feedback is invaluable to us. We&apos;re
            actively collecting insights from our community to improve the platform.
          </p>
          <p>
            Early contributors and testers will be recognized for their participation in shaping
            WarpX.
          </p>
          <p>Please note: This is a testnet deployment. Use test tokens only.</p>
        </div>
        <button
          type="button"
          onClick={handleAccept}
          className="mt-6 w-full border-2 border-primary/60 px-4 py-3 font-mono text-xs uppercase tracking-[0.35em] text-primary transition hover:bg-primary hover:text-black"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}
