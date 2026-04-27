#!/usr/bin/env node
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HANDSHAKE = path.join(os.homedir(), '.odm', 'handshake.json');

function readMessage() {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    process.stdin.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4) return;
      const size = buffer.readUInt32LE(0);
      if (buffer.length < size + 4) return;
      resolve(JSON.parse(buffer.subarray(4, size + 4).toString('utf8')));
    });
    process.stdin.on('end', () => reject(new Error('stream ended')));
    process.stdin.on('error', reject);
  });
}

function writeMessage(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(header);
  process.stdout.write(body);
}

function readHandshake() {
  try {
    return JSON.parse(fs.readFileSync(HANDSHAKE, 'utf8'));
  } catch {
    return null;
  }
}

function postJson(baseUrl, token, pathname, payload) {
  const body = JSON.stringify(payload);
  const url = new URL(pathname, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Odm-Token': token,
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(text)); } catch { resolve(text); }
          return;
        }
        reject(new Error(`HTTP ${res.statusCode}: ${text}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function appBundlePath() {
  const marker = '.app/';
  const idx = process.execPath.indexOf(marker);
  return idx >= 0 ? process.execPath.slice(0, idx + 4) : '';
}

function focusApp() {
  try {
    if (process.platform === 'darwin') {
      const bundle = appBundlePath();
      if (bundle) {
        spawn('open', [bundle], { detached: true, stdio: 'ignore' }).unref();
        return;
      }
    }
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    spawn(process.execPath, [], { detached: true, stdio: 'ignore', env }).unref();
  } catch {}
}

async function postWhenReady(payload) {
  let lastError = null;
  for (let i = 0; i < 30; i++) {
    const handshake = readHandshake();
    if (handshake && handshake.baseUrl && handshake.token) {
      try {
        return await postJson(handshake.baseUrl, handshake.token, '/api/intake', payload);
      } catch (e) {
        lastError = e;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error('ODM is not running');
}

async function handle(message) {
  if (message.action === 'handshake') {
    const handshake = readHandshake();
    if (!handshake || !handshake.baseUrl || !handshake.token) {
      return { ok: false, error: 'ODM is not running' };
    }
    return { ok: true, ...handshake };
  }
  if (message.action === 'enqueue') {
    focusApp();
    const result = await postWhenReady(message.payload || {});
    return { ok: true, result };
  }
  return { ok: false, error: 'unknown action' };
}

(async () => {
  try {
    const message = await readMessage();
    writeMessage(await handle(message));
  } catch (e) {
    writeMessage({ ok: false, error: String(e && e.message || e) });
  }
})();
