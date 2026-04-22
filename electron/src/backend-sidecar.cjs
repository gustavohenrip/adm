const { spawn } = require('node:child_process');
const path = require('node:path');
const { app } = require('electron');

let backendProcess = null;
let backendPort = null;
let backendToken = null;

const READY_REGEX = /ADM_READY port=(\d+) token=([A-Za-z0-9_-]+)/;

function resolveJavaBin() {
  const jdkPath = path.join(process.resourcesPath ?? '', 'jdk');
  const javaName = process.platform === 'win32' ? 'java.exe' : 'java';
  if (process.resourcesPath) {
    return path.join(jdkPath, 'bin', javaName);
  }
  return 'java';
}

function resolveBackendJar() {
  if (process.resourcesPath) {
    return path.join(process.resourcesPath, 'backend', 'adm-backend.jar');
  }
  return path.resolve(__dirname, '..', '..', 'backend', 'build', 'libs', 'adm-backend-0.1.0-SNAPSHOT.jar');
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
      env: { ...process.env, ADM_MODE: 'embedded' },
    });

    const timeout = setTimeout(() => {
      reject(new Error('backend start timed out after 60s'));
    }, 60_000);

    backendProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      process.stdout.write(`[backend] ${text}`);
      const match = text.match(READY_REGEX);
      if (match && !backendPort) {
        backendPort = Number(match[1]);
        backendToken = match[2];
        clearTimeout(timeout);
        resolve({ port: backendPort, token: backendToken });
      }
    });

    backendProcess.stderr.on('data', (chunk) => {
      process.stderr.write(`[backend-err] ${chunk.toString('utf8')}`);
    });

    backendProcess.on('exit', (code) => {
      console.log(`[ADM] backend exited with code ${code}`);
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
  if (process.env.ADM_DEV === '1') {
    return {
      port: Number(process.env.ADM_BACKEND_PORT ?? 0),
      token: process.env.ADM_BACKEND_TOKEN ?? '',
      dev: true,
    };
  }
  return { port: backendPort, token: backendToken, dev: false };
}

module.exports = { startBackend, stopBackend, getBackendInfo };
