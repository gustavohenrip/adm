const { clipboard } = require('electron');

const URL_REGEX = /^(https?|ftp|magnet):/i;
let lastSeen = '';
let timer = null;

function start(onUrl) {
  lastSeen = clipboard.readText();
  timer = setInterval(() => {
    try {
      const current = clipboard.readText();
      if (current === lastSeen) return;
      lastSeen = current;
      const trimmed = current.trim();
      if (trimmed.length < 4 || trimmed.length > 32768) return;
      if (!URL_REGEX.test(trimmed)) return;
      onUrl(trimmed);
    } catch {}
  }, 1200);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop };
