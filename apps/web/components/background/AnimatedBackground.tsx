'use client';

type AnimatedBackgroundProps = {
  variant?: "swap" | "pools" | "stake";
};

const gradientMap: Record<NonNullable<AnimatedBackgroundProps["variant"]>, string> = {
  swap: "from-primary/25 via-transparent to-transparent",
  pools: "from-secondary/30 via-transparent to-transparent",
  stake: "from-primary/15 via-transparent to-transparent"
};

export function AnimatedBackground({ variant = "swap" }: AnimatedBackgroundProps) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientMap[variant]}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] opacity-40" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22 fill=%22none%22%3E%3Cpath d=%22M0 20 H40%22 stroke=%22rgba(255,255,255,0.02)%22/%3E%3Cpath d=%22M20 0 V40%22 stroke=%22rgba(255,255,255,0.02)%22/%3E%3C/svg%3E')] opacity-30" />
    </div>
  );
}
