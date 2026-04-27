#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HANDSHAKE = path.join(os.homedir(), '.odm', 'handshake.json');

function readMessage() {
  return new Promise((resolve, reject) => {
    let header = Buffer.alloc(0);
    let body = null;
    let bodyLen = 0;
    let collected = Buffer.alloc(0);

    const onData = (chunk) => {
      collected = Buffer.concat([collected, chunk]);
      if (body === null && collected.length >= 4) {
        bodyLen = collected.readUInt32LE(0);
        header = collected.slice(0, 4);
        collected = collected.slice(4);
        body = Buffer.alloc(0);
      }
      if (body !== null) {
        const remaining = bodyLen - body.length;
        if (collected.length >= remaining) {
          body = Buffer.concat([body, collected.slice(0, remaining)]);
          process.stdin.removeListener('data', onData);
          process.stdin.removeListener('end', onEnd);
          resolve(JSON.parse(body.toString('utf8')));
        } else {
          body = Buffer.concat([body, collected]);
          collected = Buffer.alloc(0);
        }
      }
    };
    const onEnd = () => reject(new Error('stream ended'));

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
  });
}

function writeMessage(payload) {
  const buf = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

function loadHandshake() {
  try {
    const raw = fs.readFileSync(HANDSHAKE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function handleRequest(req) {
  const action = req && req.action;
  if (action === 'handshake') {
    const data = loadHandshake();
    if (!data) return { ok: false, error: 'odm not running' };
    return { ok: true, ...data };
  }
  if (action === 'enqueue') {
    const data = loadHandshake();
    if (!data) return { ok: false, error: 'odm not running' };
    try {
      const body = JSON.stringify(req.payload || {});
      const result = await postJson(`${data.baseUrl}/api/downloads`, body, data.token);
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }
  return { ok: false, error: 'unknown action: ' + action };
}

function postJson(url, body, token) {
  const lib = url.startsWith('https:') ? require('node:https') : require('node:http');
  const u = new URL(url);
  const opts = {
    method: 'POST',
    hostname: u.hostname,
    port: u.port,
    path: u.pathname + (u.search || ''),
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-Odm-Token': token,
    },
  };
  return new Promise((resolve, reject) => {
    const req = lib.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(chunks)); } catch { resolve(chunks); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${chunks}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    const req = await readMessage();
    const reply = await handleRequest(req);
    writeMessage(reply);
  } catch (e) {
    writeMessage({ ok: false, error: String(e && e.message || e) });
  }
  process.exit(0);
})();
