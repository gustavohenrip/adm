const DEFAULTS = {
  enabled: true,
  showNotifications: true,
  minSizeKB: 0,
  extensions: [
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
    'torrent',
    'iso', 'dmg', 'pkg', 'exe', 'msi', 'deb', 'rpm', 'apk', 'appimage',
    'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'mpg',
    'mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'opus',
    'pdf', 'epub',
  ],
  excludeHosts: ['mail.google.com', 'docs.google.com', 'drive.google.com'],
  excludeMime: ['text/html', 'application/xhtml+xml'],
};

const els = {
  enabled: document.getElementById('enabled'),
  showNotifications: document.getElementById('showNotifications'),
  minSizeKB: document.getElementById('minSizeKB'),
  extensions: document.getElementById('extensions'),
  excludeHosts: document.getElementById('excludeHosts'),
  excludeMime: document.getElementById('excludeMime'),
  save: document.getElementById('save'),
  reset: document.getElementById('reset'),
  status: document.getElementById('status'),
};

async function load() {
  const stored = await chrome.storage.sync.get('odmSettings');
  const v = { ...DEFAULTS, ...(stored.odmSettings || {}) };
  els.enabled.checked = !!v.enabled;
  els.showNotifications.checked = !!v.showNotifications;
  els.minSizeKB.value = v.minSizeKB ?? DEFAULTS.minSizeKB;
  els.extensions.value = (v.extensions || []).join(', ');
  els.excludeHosts.value = (v.excludeHosts || []).join('\n');
  els.excludeMime.value = (v.excludeMime || []).join(', ');
}

function parseList(value, sep) {
  return value
    .split(sep)
    .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
    .filter((s) => s.length > 0);
}

async function save() {
  const next = {
    enabled: els.enabled.checked,
    showNotifications: els.showNotifications.checked,
    minSizeKB: Math.max(0, Number(els.minSizeKB.value) || 0),
    extensions: parseList(els.extensions.value, /[\s,]+/),
    excludeHosts: parseList(els.excludeHosts.value, /[\s,\n]+/),
    excludeMime: parseList(els.excludeMime.value, /[\s,]+/),
  };
  await chrome.storage.sync.set({ odmSettings: next });
  els.status.className = 'status ok';
  els.status.textContent = 'Saved.';
  setTimeout(() => { els.status.textContent = ''; els.status.className = 'status'; }, 2000);
}

async function reset() {
  await chrome.storage.sync.set({ odmSettings: DEFAULTS });
  await load();
  els.status.className = 'status ok';
  els.status.textContent = 'Defaults restored.';
  setTimeout(() => { els.status.textContent = ''; els.status.className = 'status'; }, 2000);
}

els.save.addEventListener('click', save);
els.reset.addEventListener('click', reset);
load();
