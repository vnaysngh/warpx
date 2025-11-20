/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import styles from "./page.module.css";
import { AnimatedBackground } from "@/components/background/AnimatedBackground";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://testnet.warpx.exchange"
    : "http://localhost:3000");

export default function LandingPage() {
  return (
    <>
      <AnimatedBackground variant="landing" />

      <div className={`${styles.page} ${styles.shell}`}>
        <header className={styles.nav}>
          <div className={styles.brand}>
            <img src="/logo.png" alt="WarpX" className={styles.brandLogo} />
            <div className={styles.brandText}>
              <span className={styles.brandMain}>WarpX</span>
              {/* <span className={styles.brandSub}>Built on MegaETH</span> */}
            </div>
          </div>
          <Link href={appUrl} className={styles.ctaButton}>
            Launch App
          </Link>
        </header>

        <main className={styles.main}>
          <section className={styles.hero}>
            <div className={styles.heroText}>
              <h1 className={styles.heroHeadline}>
                The AMM built for instant MegaETH liquidity
              </h1>
              <p className={styles.heroCopy}>
                WarpX brings the classic constant-product design to MegaETH with
                deterministic execution, pooled routing, and advanced analytics
                for LPs. Step into the next era of trustless swaps.
              </p>
              <Link href={appUrl} className={styles.ctaPrimary}>
                Launch App
              </Link>
            </div>
            <div className={styles.heroGraphic} aria-hidden="true">
              <div className={styles.speedCard}>
                <div className={styles.speedHeader}>
                  <span>Transaction finality</span>
                </div>

                <div className={styles.speedLane}>
                  <div className={styles.laneLabel}>Other chains</div>
                  <div className={styles.laneTrack}>
                    <div
                      className={`${styles.laneMeter} ${styles.laneMeterSlow}`}
                    />
                    <div
                      className={`${styles.laneGlow} ${styles.laneGlowSlow}`}
                    />
                    <div className={styles.laneTime}>12–15s</div>
                  </div>
                </div>

                <div className={`${styles.speedLane} ${styles.speedLaneMega}`}>
                  <div className={styles.laneLabel}>MegaETH</div>
                  <div className={styles.laneTrack}>
                    <div
                      className={`${styles.laneMeter} ${styles.laneMeterFast}`}
                    />
                    <div
                      className={`${styles.laneGlow} ${styles.laneGlowFast}`}
                    />
                    <div className={styles.laneTime}>10ms</div>
                  </div>
                </div>

                <div className={styles.speedFooter}>
                  <span>MegaETH keeps deterministic 10ms blocks</span>
                  <span className={styles.speedFootNote}>
                    WarpX routes settle instantly
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Future marketing modules can be re-enabled here */}
          {/* <section id="features" className={styles.featureSection}>
          ...
        </section> */}
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <p className={styles.footerText}>
              Built on MegaETH Testnet • Early Access
            </p>
            <div className={styles.socialLinks}>
              <a
                href="https://t.me/+_300oWZNXkdjNzhl"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="Join our Telegram"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-.962 3.767-1.362 5.001-.168.521-.501.695-.821.712-.697.036-1.227-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.429-.009-1.252-.242-1.865-.442-.752-.244-1.349-.374-1.297-.788.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.121.099.155.232.171.326.016.094.036.308.02.475z" />
                </svg>
              </a>
              <a
                href="https://x.com/warpexchange"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="Follow us on Twitter"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
