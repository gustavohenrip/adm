const DISCOVERY_PORTS = [9614, 9615, 9616, 9617, 9618];
const DISCOVERY_TTL_MS = 60_000;
const REQUEST_TTL_MS = 120_000;
const RECENT_TTL_MS = 45_000;
const NATIVE_HOST = 'com.opendownloader.odm';

const DOWNLOAD_TYPES = ['main_frame', 'sub_frame', 'object', 'xmlhttprequest', 'other'];
const INTERNAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const LINK_HOST_HINTS = [
  'mediafire.com',
  'modsfire.com',
  'golink.to',
  'golink.pro',
  'golink.net',
  'gofile.io',
];

const DEFAULT_SETTINGS = {
  enabled: true,
  minSizeKB: 0,
  extensions: [
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
    'torrent',
    'iso', 'dmg', 'pkg', 'exe', 'msi', 'deb', 'rpm', 'apk', 'appimage',
    'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg',
    'mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'opus',
    'pdf', 'epub',
  ],
  excludeHosts: ['mail.google.com', 'docs.google.com', 'drive.google.com'],
  excludeMime: ['text/html', 'application/xhtml+xml'],
  showNotifications: true,
};

let discoveryCache = null;
let settingsCache = normalizeSettings(DEFAULT_SETTINGS);
const responseCache = new Map();
const recentIntercepts = new Map();
const activeSends = new Map();

loadSettings().catch(() => {});
getHandshake({ force: true }).catch(() => {});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.odmSettings) {
    settingsCache = normalizeSettings({ ...DEFAULT_SETTINGS, ...(changes.odmSettings.newValue || {}) });
  }
});

async function loadSettings() {
  const stored = await chrome.storage.sync.get('odmSettings');
  settingsCache = normalizeSettings({ ...DEFAULT_SETTINGS, ...(stored.odmSettings || {}) });
  return settingsCache;
}

function normalizeSettings(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    extensions: normalizeList(settings.extensions ?? DEFAULT_SETTINGS.extensions),
    excludeHosts: normalizeList(settings.excludeHosts ?? DEFAULT_SETTINGS.excludeHosts),
    excludeMime: normalizeList(settings.excludeMime ?? DEFAULT_SETTINGS.excludeMime),
    minSizeKB: Math.max(0, Number(settings.minSizeKB ?? DEFAULT_SETTINGS.minSizeKB) || 0),
  };
}

function normalizeList(values) {
  return Array.isArray(values)
    ? values.map((v) => String(v).trim().toLowerCase().replace(/^\./, '')).filter(Boolean)
    : [];
}

function extensionOf(url, filename) {
  const tryName = (s) => {
    const m = /\.([a-z0-9]{1,8})(?:[?#].*)?$/i.exec(s || '');
    return m ? m[1].toLowerCase() : '';
  };
  return tryName(filename) || tryName(url);
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function isHttpUrl(url) {
  return /^https?:/i.test(url || '');
}

function isMagnetUrl(url) {
  return /^magnet:/i.test(url || '');
}

function matchesHost(host, list) {
  return list.some((item) => host === item || host.endsWith(`.${item}`));
}

function isExcludedUrl(url, settings) {
  const host = hostOf(url);
  if (!host || INTERNAL_HOSTS.has(host)) return true;
  return matchesHost(host, settings.excludeHosts);
}

function headerValue(headers, name) {
  const target = name.toLowerCase();
  const item = (headers || []).find((h) => h.name && h.name.toLowerCase() === target);
  return item ? item.value || '' : '';
}

function parseResponseInfo(details) {
  const disposition = headerValue(details.responseHeaders, 'content-disposition');
  const contentType = headerValue(details.responseHeaders, 'content-type').split(';')[0].trim().toLowerCase();
  const lengthRaw = headerValue(details.responseHeaders, 'content-length');
  const contentRange = headerValue(details.responseHeaders, 'content-range');
  let sizeBytes = Number.parseInt(lengthRaw, 10);
  if (!Number.isFinite(sizeBytes) && contentRange) {
    const slash = contentRange.lastIndexOf('/');
    if (slash > -1) sizeBytes = Number.parseInt(contentRange.slice(slash + 1), 10);
  }
  return {
    disposition,
    contentType,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
    acceptsRanges: headerValue(details.responseHeaders, 'accept-ranges').toLowerCase() === 'bytes'
      || details.statusCode === 206,
    filename: filenameFromDisposition(disposition),
  };
}

function filenameFromDisposition(disposition) {
  if (!disposition) return '';
  const star = /filename\*=([^;]+)/i.exec(disposition);
  if (star) {
    const raw = star[1].trim().replace(/^utf-8''/i, '');
    try { return decodeURIComponent(stripQuotes(raw)); } catch { return stripQuotes(raw); }
  }
  const normal = /filename=([^;]+)/i.exec(disposition);
  return normal ? stripQuotes(normal[1].trim()) : '';
}

function stripQuotes(value) {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

function hasAttachmentDisposition(disposition) {
  return /(^|;)\s*attachment\b/i.test(disposition || '') || /filename\*?=/i.test(disposition || '');
}

function isBinaryMime(contentType) {
  if (!contentType) return false;
  if (contentType.startsWith('video/') || contentType.startsWith('audio/')) return true;
  if (contentType === 'application/octet-stream') return true;
  if (contentType === 'application/pdf') return true;
  if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('7z')) return true;
  if (contentType.includes('x-msdownload') || contentType.includes('x-dosexec')) return true;
  if (contentType.startsWith('application/vnd.')) return true;
  return contentType.startsWith('application/x-') && !contentType.includes('html') && !contentType.includes('json');
}

function shouldInterceptResponse(details, info, settings) {
  if (!settings.enabled) return false;
  if (details.method && details.method.toUpperCase() !== 'GET') return false;
  if (!isHttpUrl(details.url) || isExcludedUrl(details.url, settings)) return false;
  if (info.contentType && settings.excludeMime.includes(info.contentType)) return false;
  const ext = extensionOf(details.url, info.filename);
  if (hasAttachmentDisposition(info.disposition)) return true;
  if (ext && settings.extensions.includes(ext)) return true;
  const sizeKB = Math.max(0, info.sizeBytes || 0) / 1024;
  return sizeKB >= settings.minSizeKB && isBinaryMime(info.contentType);
}

function shouldCaptureLink(url, settings, hasDownloadAttribute = false, label = '') {
  if (!settings.enabled) return false;
  if (isMagnetUrl(url)) return true;
  if (!isHttpUrl(url) || isExcludedUrl(url, settings)) return false;
  if (hasDownloadAttribute) return true;
  const host = hostOf(url);
  const ext = extensionOf(url, '');
  if (ext && settings.extensions.includes(ext)) return true;
  return matchesHost(host, LINK_HOST_HINTS)
    && /\b(download|baixar|descargar|telecharger|télécharger|scarica)\b/i.test(label || '');
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
    } catch {}
  }
  return null;
}

async function nativeMessage(action, payload = {}) {
  try {
    const response = await chrome.runtime.sendNativeMessage(NATIVE_HOST, { action, payload });
    if (!response) return { ok: false, error: 'native host did not respond' };
    return response;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

async function getHandshake({ force = false } = {}) {
  if (!force && discoveryCache && discoveryCache.ok && Date.now() - discoveryCache.fetchedAt < DISCOVERY_TTL_MS) {
    return discoveryCache;
  }
  const native = await nativeMessage('handshake');
  if (native && native.ok && native.port && native.token) {
    discoveryCache = { ...native, fetchedAt: Date.now(), native: true };
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
      message: String(message || '').slice(0, 300),
      priority: 0,
    });
  } catch {}
}

async function postToBackend(handshake, body) {
  const url = `${handshake.baseUrl}/api/intake`;
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

function downloadPayload(url, options = {}) {
  return {
    url,
    folder: options.folder,
    referer: options.referer || '',
    cookies: options.cookieHeader || options.cookies || '',
    userAgent: options.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    filename: options.filename || undefined,
    sizeBytes: options.sizeBytes,
    acceptsRanges: options.acceptsRanges,
    probe: options.probe,
  };
}

async function sendToOdm(url, options = {}) {
  const key = requestKey(url);
  if (activeSends.has(key)) return activeSends.get(key);
  const task = sendToOdmNow(url, options).finally(() => activeSends.delete(key));
  activeSends.set(key, task);
  return task;
}

async function sendToOdmNow(url, options = {}) {
  const cookieHeader = isHttpUrl(url) ? options.cookieHeader || options.cookies || (await getCookieHeader(url)) : '';
  const body = downloadPayload(url, { ...options, cookieHeader });
  const native = await nativeMessage('enqueue', body);
  if (native && native.ok) {
    return { ok: true, result: native.result, native: true };
  }
  const handshake = await getHandshake();
  if (!handshake.ok) {
    return { ok: false, error: native.error || handshake.error || 'ODM is not running' };
  }
  try {
    const result = await postToBackend(handshake, body);
    return { ok: true, result };
  } catch (e) {
    discoveryCache = null;
    return { ok: false, error: String(e && e.message || e) };
  }
}

function requestKey(url) {
  const value = String(url || '').trim();
  const match = /xt=urn:btih:([^&]+)/i.exec(value);
  if (match) return `torrent:${match[1].toLowerCase()}`;
  return value.toLowerCase();
}

function rememberRecent(url) {
  recentIntercepts.set(requestKey(url), Date.now());
  pruneRecent();
}

function wasRecentlyIntercepted(url) {
  pruneRecent();
  const at = recentIntercepts.get(requestKey(url));
  return at && Date.now() - at < RECENT_TTL_MS;
}

function pruneRecent() {
  const now = Date.now();
  for (const [url, at] of recentIntercepts) {
    if (now - at > RECENT_TTL_MS) recentIntercepts.delete(url);
  }
}

function rememberResponse(details, info) {
  responseCache.set(details.url, { ...info, timeStamp: Date.now() });
  pruneResponses();
}

function responseFor(url) {
  pruneResponses();
  return responseCache.get(url) || {};
}

function pruneResponses() {
  const now = Date.now();
  for (const [url, item] of responseCache) {
    if (now - item.timeStamp > REQUEST_TTL_MS) responseCache.delete(url);
  }
}

function interceptResponse(details) {
  const settings = settingsCache;
  const info = parseResponseInfo(details);
  if (!shouldInterceptResponse(details, info, settings)) return {};
  rememberResponse(details, info);
  return {};
}

function shouldInterceptDownloadItem(item, settings) {
  if (!settings.enabled) return false;
  if (item.byExtensionId) return false;
  if (item.state !== 'in_progress' && item.state !== 'interrupted') return false;
  const url = item.finalUrl || item.url;
  if (!isHttpUrl(url) || isExcludedUrl(url, settings)) return false;
  if (item.mime && settings.excludeMime.includes(item.mime.toLowerCase())) return false;
  const ext = extensionOf(url, item.filename);
  const sizeKB = Math.max(0, (item.totalBytes || 0) / 1024);
  if (ext && settings.extensions.includes(ext)) return true;
  return sizeKB >= settings.minSizeKB;
}

try {
  chrome.webRequest.onHeadersReceived.addListener(
    interceptResponse,
    { urls: ['<all_urls>'], types: DOWNLOAD_TYPES },
    ['responseHeaders', 'extraHeaders'],
  );
} catch (e) {
  notify('ODM interception limited', String(e && e.message || e));
}

chrome.downloads.onCreated.addListener(async (item) => {
  try {
    const settings = await loadSettings();
    if (!shouldInterceptDownloadItem(item, settings)) return;
    const url = item.finalUrl || item.url;
    if (!url || wasRecentlyIntercepted(url)) return;
    const response = responseFor(url);
    const cookieHeader = await getCookieHeader(url);
    const result = await sendToOdm(url, {
      referer: item.referrer || '',
      cookieHeader,
      filename: item.filename ? item.filename.split(/[\\/]/).pop() : response.filename || undefined,
      sizeBytes: item.totalBytes > 0 ? item.totalBytes : response.sizeBytes,
      acceptsRanges: !!response.acceptsRanges,
      probe: false,
    });
    if (result.ok) {
      rememberRecent(url);
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
    const settings = await loadSettings();
    const cookieHeader = await getCookieHeader(url);
    const referer = (tab && tab.url) || '';
    const direct = info.menuItemId === 'odm-send-link' && shouldCaptureLink(url, settings, false);
    const result = await sendToOdm(url, { referer, cookieHeader, probe: direct ? false : undefined });
    if (result.ok) {
      rememberRecent(url);
      await notify('Sent to ODM', url);
    } else {
      await notify('ODM error', result.error || 'unknown');
    }
  } catch (e) {
    await notify('ODM bridge error', String(e && e.message || e));
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'odm/handshake') {
    getHandshake({ force: true })
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }
  if (msg && msg.type === 'odm/send') {
    sendToOdm(msg.url, { referer: msg.referer, probe: msg.probe })
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }
  if (msg && msg.type === 'odm/capture-link') {
    loadSettings().then((settings) => {
      if (!shouldCaptureLink(msg.url, settings, !!msg.download, msg.label || '')) {
        sendResponse({ ok: false, capture: false });
        return null;
      }
      return sendToOdm(msg.url, {
        referer: msg.referer || (sender.tab && sender.tab.url) || '',
        filename: msg.filename || undefined,
        probe: false,
      }).then((result) => {
        if (result.ok) {
          rememberRecent(msg.url);
          notify('Sent to ODM', msg.url);
        } else {
          notify('ODM error', result.error || 'unknown');
        }
        sendResponse({ ...result, capture: true });
      });
    }).catch((e) => sendResponse({ ok: false, capture: true, error: String(e && e.message || e) }));
    return true;
  }
  return false;
});
