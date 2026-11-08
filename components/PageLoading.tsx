// Schlichter Skeleton für loading.tsx — sofortiges Feedback nach einem Tap,
// statt bei schwachem Gym-WLAN auf der alten Seite zu "hängen".
export default function PageLoading({ maxWidth = "max-w-2xl" }: { maxWidth?: string }) {
  return (
    <main
      className={`mx-auto ${maxWidth} px-4 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))]`}
      aria-busy="true"
      aria-label="Lädt"
    >
      <div className="mb-6 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
        <div className="h-7 w-48 animate-pulse rounded-lg bg-surface-2" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-24 animate-pulse" />
        ))}
      </div>
    </main>
  );
}
