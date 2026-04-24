const { spawn } = require('node:child_process');
const path = require('node:path');
const { app } = require('electron');

let backendProcess = null;
let backendPort = null;
let backendToken = null;

const READY_REGEX = /ODM_READY port=(\d+) token=([A-Za-z0-9_-]+)/;

function resolveJavaBin() {
  const javaName = process.platform === 'win32' ? 'java.exe' : 'java';
  if (process.resourcesPath) {
    const bundled = path.join(process.resourcesPath, 'jdk', 'bin', javaName);
    const fs = require('node:fs');
    if (fs.existsSync(bundled)) return bundled;
  }
  return javaName;
}

function resolveBackendJar() {
  if (process.resourcesPath) {
    return path.join(process.resourcesPath, 'backend', 'odm-backend.jar');
  }
  return path.resolve(__dirname, '..', '..', 'backend', 'build', 'libs', 'odm-backend-1.0.0.jar');
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const javaBin = resolveJavaBin();
    const jar = resolveBackendJar();
    const userHome = app.getPath('home');

    const fs = require('node:fs');
    fs.writeFileSync('/tmp/odm-sidecar-debug.txt',
      `javaBin=${javaBin}\njar=${jar}\nhome=${userHome}\nPATH=${process.env.PATH}\n`
    );

    backendProcess = spawn(javaBin, [
      '-Xms128m',
      '-Xmx512m',
      '-Dfile.encoding=UTF-8',
      `-Duser.home=${userHome}`,
      '-jar',
      jar,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ODM_MODE: 'embedded' },
    });

    const timeout = setTimeout(() => {
      reject(new Error('backend start timed out after 60s'));
    }, 60_000);

    backendProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      fs.appendFileSync('/tmp/odm-sidecar-debug.txt', `stdout: ${text}`);
      process.stdout.write(`[backend] ${text}`);
      const match = text.match(READY_REGEX);
      if (match && !backendPort) {
        backendPort = Number(match[1]);
        backendToken = match[2];
        clearTimeout(timeout);
        resolve({ port: backendPort, token: backendToken });
      }
    });

    backendProcess.on('error', (err) => {
      fs.appendFileSync('/tmp/odm-sidecar-debug.txt', `spawn-error: ${err.message}\n`);
      clearTimeout(timeout);
      reject(err);
    });

    backendProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      fs.appendFileSync('/tmp/odm-sidecar-debug.txt', `stderr: ${text}`);
      process.stderr.write(`[backend-err] ${text}`);
    });

    backendProcess.on('exit', (code) => {
      fs.appendFileSync('/tmp/odm-sidecar-debug.txt', `exit: ${code}\n`);
      console.log(`[ODM] backend exited with code ${code}`);
      backendProcess = null;
      backendPort = null;
      backendToken = null;
    });
  });
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM');
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) backendProcess.kill('SIGKILL');
    }, 5_000);
  }
}

function getBackendInfo() {
  if (process.env.ODM_DEV === '1') {
    return {
      port: Number(process.env.ODM_BACKEND_PORT ?? 0),
      token: process.env.ODM_BACKEND_TOKEN ?? '',
      dev: true,
    };
  }
  return { port: backendPort, token: backendToken, dev: false };
}

module.exports = { startBackend, stopBackend, getBackendInfo };
