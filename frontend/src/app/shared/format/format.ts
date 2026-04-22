export function formatSize(gb: number): string {
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = gb * 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(mb * 1024).toFixed(0)} KB`;
}

export function formatBytes(bytes: number): string {
  return formatSize(bytes / (1024 * 1024 * 1024));
}

export function formatSpeed(mbps: number): string {
  if (mbps <= 0) return '—';
  return `${mbps.toFixed(1)} MB/s`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}
