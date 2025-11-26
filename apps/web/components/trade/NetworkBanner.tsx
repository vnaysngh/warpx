type NetworkBannerProps = {
  error: string | null;
  onSwitch: () => void;
  isSwitching: boolean;
};

export function NetworkBanner({
  error,
  onSwitch,
  isSwitching
}: NetworkBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded border border-warning/30 bg-warning/10 px-4 py-3 text-xs font-mono uppercase tracking-[0.3em] text-warning">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{error}</span>
        <button
          className="rounded border border-warning px-4 py-1 text-warning transition hover:bg-warning hover:text-black disabled:opacity-60"
          type="button"
          onClick={onSwitch}
          disabled={isSwitching}
        >
          {isSwitching ? "Switching…" : "Switch"}
        </button>
      </div>
    </div>
  );
}
