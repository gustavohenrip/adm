const ODM_EXTENSIONS = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
  'torrent',
  'iso', 'dmg', 'pkg', 'exe', 'msi', 'deb', 'rpm', 'apk', 'appimage',
  'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg',
  'mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'opus',
  'pdf', 'epub',
]);

const ODM_HOST_HINTS = [
  'mediafire.com',
  'modsfire.com',
  'golink.to',
  'golink.pro',
  'golink.net',
  'gofile.io',
];

function odmHostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function odmMatchesHost(host, list) {
  return list.some((item) => host === item || host.endsWith(`.${item}`));
}

function odmExtensionOf(url) {
  const match = /\.([a-z0-9]{1,8})(?:[?#].*)?$/i.exec(url || '');
  return match ? match[1].toLowerCase() : '';
}

function odmShouldCapture(anchor, url) {
  if (/^magnet:/i.test(url)) return true;
  if (!/^https?:/i.test(url)) return false;
  const host = odmHostOf(url);
  if (!host || host === 'localhost' || host === '127.0.0.1') return false;
  if (anchor.hasAttribute('download')) return true;
  const ext = odmExtensionOf(url);
  if (ODM_EXTENSIONS.has(ext)) return true;
  const label = `${anchor.textContent || ''} ${anchor.getAttribute('aria-label') || ''} ${anchor.title || ''}`.toLowerCase();
  return odmMatchesHost(host, ODM_HOST_HINTS) && /\b(download|baixar|descargar|telecharger|télécharger|scarica)\b/.test(label);
}

function odmContinue(url, target) {
  if (target && target !== '_self') {
    window.open(url, target);
    return;
  }
  window.location.href = url;
}

function odmFilename(anchor, url) {
  const named = anchor.getAttribute('download');
  if (named && named.trim()) return named.trim();
  try {
    const path = new URL(url).pathname;
    const last = path.split('/').filter(Boolean).pop();
    return last && last.includes('.') ? decodeURIComponent(last) : '';
  } catch {
    return '';
  }
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const start = event.target && event.target.closest ? event.target : event.target && event.target.parentElement;
  const anchor = start && start.closest ? start.closest('a[href]') : null;
  if (!anchor) return;
  const url = anchor.href;
  if (!odmShouldCapture(anchor, url)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  chrome.runtime.sendMessage({
    type: 'odm/capture-link',
    url,
    referer: window.location.href,
    download: anchor.hasAttribute('download'),
    label: `${anchor.textContent || ''} ${anchor.getAttribute('aria-label') || ''} ${anchor.title || ''}`,
    filename: odmFilename(anchor, url),
  }, (response) => {
    if (chrome.runtime.lastError || !response || response.ok === false) {
      if (!response || response.capture !== false) odmContinue(url, anchor.target);
      else odmContinue(url, anchor.target);
    }
  });
}, true);
