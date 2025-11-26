"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Radio, Activity } from "lucide-react";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://testnet.warpx.exchange"
    : "http://localhost:3000");

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] relative overflow-hidden">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur-md z-50 flex items-center px-6 justify-between">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-[hsl(var(--primary))] text-black flex items-center justify-center font-bold font-display text-xl skew-x-[-10deg] group-hover:skew-x-0 transition-transform">
              W
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg leading-none tracking-tight">
                WARP<span className="text-[hsl(var(--primary))]">X</span>
              </span>
              <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] leading-none tracking-widest">
                PROTOCOL
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 border-l border-[hsl(var(--border))] pl-6 h-8">
            <Link
              href={appUrl}
              className="px-6 py-2 text-sm font-mono uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              TERMINAL
            </Link>
            <Link
              href={`${appUrl}/pools`}
              className="px-6 py-2 text-sm font-mono uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              LIQUIDITY
            </Link>
            <Link
              href={`${appUrl}`}
              className="px-6 py-2 text-sm font-mono uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              DATA
            </Link>
          </nav>
        </div>

        {/* Right: Status & Wallet */}
        <div className="hidden md:flex items-center gap-6">
          {/* Status */}
          {/*      <div className="flex items-center gap-4 text-xs font-mono text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))] pr-6 h-8">
            <div className="flex items-center gap-2">
              <Radio className="w-3 h-3 text-[hsl(var(--accent))] animate-pulse" />
              <span>MEGA_NET: ONLINE</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3" />
              <span>LATENCY: 0.8ms</span>
            </div>
          </div> */}

          <Link
            href={appUrl}
            className="font-mono text-xs h-9 px-4 border-2 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-black transition-all uppercase tracking-wide rounded-none flex items-center justify-center"
          >
            [ CONNECT_WALLET ]
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden p-2 text-foreground hover:text-[hsl(var(--primary))]">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16 relative z-10">
        <div className="relative min-h-[calc(100vh-64px)] flex items-center overflow-hidden">
          {/* Multi-layer Background */}
          <div className="absolute inset-0 z-0">
            {/* Grid Background */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundSize: "56px 56px",
                backgroundImage:
                  "linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px)"
              }}
            />

            {/* Noise Texture Overlay */}
            <div
              className="absolute inset-0 opacity-15 mix-blend-screen pointer-events-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.2'/%3E%3C/svg%3E\")"
              }}
            />

            {/* Vignette Gradients */}
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--background))] via-transparent to-[hsl(var(--background))]" />
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--background))] via-transparent to-transparent" />
          </div>

          {/* Radar Graphic - Right Side */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] hidden lg:block opacity-20">
            <svg
              viewBox="0 0 700 700"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
            >
              {/* Concentric circles */}
              <circle
                cx="350"
                cy="350"
                r="300"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1.5"
              />
              <circle
                cx="350"
                cy="350"
                r="240"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1.5"
              />
              <circle
                cx="350"
                cy="350"
                r="180"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1.5"
              />
              <circle
                cx="350"
                cy="350"
                r="120"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1.5"
              />
              <circle
                cx="350"
                cy="350"
                r="60"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1.5"
              />
              {/* Cross lines */}
              <line
                x1="350"
                y1="50"
                x2="350"
                y2="650"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1.5"
              />
              <line
                x1="50"
                y1="350"
                x2="650"
                y2="350"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1.5"
              />
              {/* Diagonal lines */}
              <line
                x1="120"
                y1="120"
                x2="580"
                y2="580"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <line
                x1="580"
                y1="120"
                x2="120"
                y2="580"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            </svg>
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-4xl">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                {/* Status Indicator */}
                <div className="flex items-center gap-2 mb-6 text-[hsl(var(--primary))] font-mono text-sm tracking-widest uppercase">
                  <div className="w-2 h-2 bg-[hsl(var(--primary))] animate-pulse rounded-full" />
                  SYSTEM ONLINE // MEGAETH V2
                </div>

                {/* Main Heading */}
                <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-bold uppercase leading-[0.85] tracking-tighter mb-8">
                  ZERO <br />
                  LATENCY <br />
                  TRADING
                </h1>

                {/* Description */}
                <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] font-mono max-w-xl mb-12 border-l-2 border-[hsl(var(--primary))]/50 pl-6">
                  Next-generation AMM protocol engineered for high-frequency
                  execution.
                  <br />
                  Sub-millisecond settlement.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-6">
                  <Link href={appUrl}>
                    <button className="h-16 px-10 bg-[hsl(var(--primary))] text-black text-lg font-bold font-mono uppercase rounded-none hover:bg-[hsl(var(--primary))]/80 tracking-wider transition-colors">
                      INITIALIZE TERMINAL
                    </button>
                  </Link>
                  <a
                    href="https://docs.warpx.exchange/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <button className="h-16 px-10 border-2 border-white/20 text-lg font-bold font-mono uppercase rounded-none hover:bg-white hover:text-black tracking-wider transition-all">
                      PROTOCOL DOCS
                    </button>
                  </a>
                </div>
              </motion.div>
            </div>
          </div>

          {/* System Status - Bottom Right */}
          <div className="absolute bottom-12 right-12 text-right hidden md:block">
            <div className="font-mono text-xs text-[hsl(var(--muted-foreground))] mb-2">
              SYSTEM STATUS
            </div>
            <div className="flex flex-col gap-1 items-end">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-32 h-1 bg-white/10">
                  <motion.div
                    className="h-full bg-[hsl(var(--primary))]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${Math.random() * 100}%` }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse",
                      delay: i * 0.1
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Decorative Corner HUD Elements */}
      <div className="fixed bottom-8 left-8 w-32 h-32 border-l border-b border-white/5 pointer-events-none z-0" />
      <div className="fixed bottom-8 right-8 w-32 h-32 border-r border-b border-white/5 pointer-events-none z-0" />
    </div>
  );
}
