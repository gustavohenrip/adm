const http = require('node:http');

const PORTS = [9614, 9615, 9616, 9617, 9618];
let server = null;
let activePort = null;
let lookup = () => null;

function buildResponse() {
  const info = lookup();
  if (!info || !info.port || !info.token) {
    return { ok: false, error: 'odm not ready' };
  }
  return {
    ok: true,
    port: info.port,
    token: info.token,
    baseUrl: `http://127.0.0.1:${info.port}`,
    version: 1,
  };
}

function allowedOrigin(origin) {
  return !origin
    || origin.startsWith('chrome-extension://')
    || origin.startsWith('moz-extension://')
    || origin.startsWith('http://127.0.0.1:')
    || origin.startsWith('http://localhost:');
}

function handle(req, res) {
  const origin = req.headers.origin || '';
  if (!allowedOrigin(origin)) {
    res.writeHead(403);
    res.end();
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', origin || 'null');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = req.url || '';
  if (url === '/odm-handshake' || url.startsWith('/odm-handshake?')) {
    const body = JSON.stringify(buildResponse());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }
  res.writeHead(404);
  res.end();
}

async function tryListen(port) {
  return new Promise((resolve, reject) => {
    const s = http.createServer(handle);
    s.once('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve(null);
      else reject(err);
    });
    s.listen(port, '127.0.0.1', () => {
      resolve(s);
    });
  });
}

async function start(infoLookup) {
  if (server) return activePort;
  lookup = typeof infoLookup === 'function' ? infoLookup : () => infoLookup;
  for (const port of PORTS) {
    try {
      const s = await tryListen(port);
      if (s) {
        server = s;
        activePort = port;
        console.log(`[ODM] discovery server listening on 127.0.0.1:${port}`);
        return port;
      }
    } catch (e) {
      console.warn('[ODM] discovery listen error:', e && e.message);
    }
  }
  console.warn('[ODM] discovery server could not bind to any port; extension will not see ODM');
  return null;
}

function stop() {
  if (server) {
    server.close();
    server = null;
    activePort = null;
  }
}

function ports() {
  return PORTS.slice();
}

module.exports = { start, stop, ports };
