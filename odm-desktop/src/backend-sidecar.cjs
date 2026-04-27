const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

let backendProcess = null;
let backendPort = null;
let backendToken = null;

const READY_REGEX = /ODM_READY port=(\d+) token=([A-Za-z0-9_-]+)/;
const pipeBackendLogs = process.env.ODM_BACKEND_LOGS === '1';

function resolveJavaBin() {
  const javaName = process.platform === 'win32' ? 'java.exe' : 'java';
  if (process.resourcesPath) {
    const bundled = path.join(process.resourcesPath, 'jdk', 'bin', javaName);
    if (fs.existsSync(bundled)) return bundled;
  }
  return javaName;
}

function resolveBackendJar() {
  if (process.env.ODM_BACKEND_JAR && fs.existsSync(process.env.ODM_BACKEND_JAR)) {
    return process.env.ODM_BACKEND_JAR;
  }
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'backend', 'odm-backend.jar'),
    process.resourcesPath && path.join(process.resourcesPath, 'backend', 'adm-backend.jar'),
    path.resolve(__dirname, '..', '..', 'resources', 'backend', 'odm-backend.jar'),
    path.resolve(__dirname, '..', '..', 'resources', 'backend', 'adm-backend.jar'),
  ].filter(Boolean);
  const libs = path.resolve(__dirname, '..', '..', 'backend', 'build', 'libs');
  if (fs.existsSync(libs)) {
    for (const file of fs.readdirSync(libs)) {
      if (/odm-backend-.*\.jar$/.test(file) && !file.endsWith('-plain.jar')) {
        candidates.push(path.join(libs, file));
      }
    }
  }
  const found = candidates.find((file) => fs.existsSync(file));
  if (found) return found;
  return path.resolve(__dirname, '..', '..', 'backend', 'build', 'libs', 'odm-backend.jar');
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const javaBin = resolveJavaBin();
    const jar = resolveBackendJar();
    const userHome = app.getPath('home');

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
      if (pipeBackendLogs) process.stdout.write(`[backend] ${text.replace(READY_REGEX, 'ODM_READY port=$1 token=<hidden>')}`);
      const match = text.match(READY_REGEX);
      if (match && !backendPort) {
        backendPort = Number(match[1]);
        backendToken = match[2];
        clearTimeout(timeout);
        resolve({ port: backendPort, token: backendToken });
      }
    });

    backendProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    backendProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      if (pipeBackendLogs) process.stderr.write(`[backend-err] ${text}`);
    });

    backendProcess.on('exit', (code) => {
      if (pipeBackendLogs) console.log(`[ODM] backend exited with code ${code}`);
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
  if (backendPort && backendToken) {
    return { port: backendPort, token: backendToken, dev: process.env.ODM_DEV === '1' };
  }
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
