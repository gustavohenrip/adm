const DISCOVERY_PORTS = [9614, 9615, 9616, 9617, 9618];
const DISCOVERY_TTL_MS = 60_000;

const DEFAULT_SETTINGS = {
  enabled: true,
  minSizeKB: 256,
  extensions: [
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
    'iso', 'dmg', 'pkg', 'exe', 'msi', 'deb', 'rpm', 'apk', 'appimage',
    'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'mpg',
    'mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'opus',
    'pdf', 'epub',
  ],
  excludeHosts: ['mail.google.com', 'docs.google.com', 'drive.google.com'],
  excludeMime: ['text/html', 'application/xhtml+xml'],
  showNotifications: true,
};

let discoveryCache = null;

async function loadSettings() {
  const stored = await chrome.storage.sync.get('odmSettings');
  return { ...DEFAULT_SETTINGS, ...(stored.odmSettings || {}) };
}

function extensionOf(url, filename) {
  const tryName = (s) => {
    const m = /\.([a-z0-9]{1,6})(?:[?#].*)?$/i.exec(s || '');
    return m ? m[1].toLowerCase() : '';
  };
  return tryName(filename) || tryName(url);
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function shouldIntercept(item, settings) {
  if (!settings.enabled) return false;
  if (item.byExtensionId) return false;
  if (item.state !== 'in_progress' && item.state !== 'interrupted') return false;
  if (item.finalUrl && /^blob:|^data:/i.test(item.finalUrl)) return false;
  if (item.finalUrl && /^https?:/i.test(item.finalUrl) === false) return false;
  const host = hostOf(item.finalUrl || item.url);
  if (settings.excludeHosts.some((h) => host.endsWith(h))) return false;
  if (item.mime && settings.excludeMime.includes(item.mime.toLowerCase())) return false;
  const ext = extensionOf(item.finalUrl || item.url, item.filename);
  const sizeKB = Math.max(0, (item.totalBytes || 0) / 1024);
  if (settings.extensions.length > 0 && ext && settings.extensions.includes(ext)) return true;
  if (sizeKB >= settings.minSizeKB) return true;
  return false;
}

async function discoverOnce() {
  for (const port of DISCOVERY_PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/odm-handshake`, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.ok && data.port && data.token) {
        return { ...data, discoveryPort: port, fetchedAt: Date.now() };
      }
      if (data && data.ok === false) {
        return { ok: false, error: data.error || 'odm not ready', discoveryPort: port };
      }
    } catch (e) {
      // try next port
    }
  }
  return null;
}

async function getHandshake({ force = false } = {}) {
  if (!force && discoveryCache && discoveryCache.ok && Date.now() - discoveryCache.fetchedAt < DISCOVERY_TTL_MS) {
    return discoveryCache;
  }
  const fresh = await discoverOnce();
  if (fresh && fresh.ok) {
    discoveryCache = fresh;
    return fresh;
  }
  if (fresh && fresh.ok === false) {
    discoveryCache = null;
    return fresh;
  }
  discoveryCache = null;
  return { ok: false, error: 'ODM is not running' };
}

async function getCookieHeader(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch {
    return '';
  }
}

async function notify(title, message) {
  const settings = await loadSettings();
  if (!settings.showNotifications) return;
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon128.png'),
      title,
      message,
      priority: 0,
    });
  } catch {}
}

async function postToBackend(handshake, body) {
  const url = `${handshake.baseUrl}/api/downloads`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Odm-Token': handshake.token,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function sendToOdm(url, options = {}) {
  const handshake = await getHandshake();
  if (!handshake.ok) {
    return { ok: false, error: handshake.error || 'discovery failed' };
  }
  const cookieHeader = options.cookieHeader || (await getCookieHeader(url));
  const body = {
    url,
    folder: options.folder,
    referer: options.referer || '',
    cookies: cookieHeader,
    userAgent: options.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
  };
  try {
    const result = await postToBackend(handshake, body);
    return { ok: true, result };
  } catch (e) {
    discoveryCache = null;
    return { ok: false, error: String(e && e.message || e) };
  }
}

chrome.downloads.onCreated.addListener(async (item) => {
  try {
    const settings = await loadSettings();
    if (!shouldIntercept(item, settings)) return;
    const url = item.finalUrl || item.url;
    if (!url) return;
    let referer = item.referrer || '';
    if (!referer) {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        referer = (tabs && tabs[0] && tabs[0].url) || '';
      } catch {}
    }
    const cookieHeader = await getCookieHeader(url);
    const result = await sendToOdm(url, { referer, cookieHeader });
    if (result.ok) {
      try { await chrome.downloads.cancel(item.id); } catch {}
      try { await chrome.downloads.erase({ id: item.id }); } catch {}
      await notify('Sent to ODM', url);
    } else {
      await notify('ODM bridge unreachable', result.error || 'unknown error');
    }
  } catch (e) {
    await notify('ODM bridge error', String(e && e.message || e));
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  try {
    chrome.contextMenus.create({
      id: 'odm-send-link',
      title: 'Send link to ODM',
      contexts: ['link'],
    });
    chrome.contextMenus.create({
      id: 'odm-send-page',
      title: 'Send page URL to ODM',
      contexts: ['page'],
    });
  } catch {}
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.menuItemId === 'odm-send-link' ? info.linkUrl : (tab && tab.url);
  if (!url) return;
  try {
    const cookieHeader = await getCookieHeader(url);
    const referer = (tab && tab.url) || '';
    const result = await sendToOdm(url, { referer, cookieHeader });
    if (result.ok) {
      await notify('Sent to ODM', url);
    } else {
      await notify('ODM error', result.error || 'unknown');
    }
  } catch (e) {
    await notify('ODM bridge error', String(e && e.message || e));
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'odm/handshake') {
    getHandshake({ force: true })
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }
  if (msg && msg.type === 'odm/send') {
    sendToOdm(msg.url, { referer: msg.referer })
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }
  return false;
});
