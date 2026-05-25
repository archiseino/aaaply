export function ProcessingOverlay() {
  return (
    <div
      className="fixed inset-0 backdrop-blur-md flex items-center justify-center flex-col gap-4 z-[60]"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-main) 85%, transparent)' }}
    >
      <div
        className="w-14 h-14 border-[3px] rounded-full animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--text-primary)' }}
      />
      <div className="flex flex-col items-center gap-1.5 px-6 text-center">
        <p className="text-base font-bold tracking-wide animate-pulse" style={{ color: 'var(--text-primary)' }}>
          AI Sedang Memproses...
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Menganalisis loker & membuat draf email terbaik untuk Anda
        </p>
      </div>
    </div>
  );
}
