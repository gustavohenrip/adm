const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOST_NAME = 'com.opendownloader.odm';
const EXTENSION_ID = 'fnmhbcgfgoaghnknfdeehccahpepkngm';

const BROWSER_PATHS = {
  darwin: {
    chrome: ['Library/Application Support/Google/Chrome/NativeMessagingHosts'],
    chromium: ['Library/Application Support/Chromium/NativeMessagingHosts'],
    edge: ['Library/Application Support/Microsoft Edge/NativeMessagingHosts'],
    brave: ['Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts'],
  },
  linux: {
    chrome: ['.config/google-chrome/NativeMessagingHosts'],
    chromium: ['.config/chromium/NativeMessagingHosts'],
    edge: ['.config/microsoft-edge/NativeMessagingHosts'],
    brave: ['.config/BraveSoftware/Brave-Browser/NativeMessagingHosts'],
  },
};

const WINDOWS_REGISTRY = {
  chrome: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts',
  chromium: 'HKCU\\Software\\Chromium\\NativeMessagingHosts',
  edge: 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts',
  brave: 'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts',
};

function copyScript(scriptSource, dataDir) {
  const target = path.join(dataDir, 'odm-native-host.cjs');
  fs.copyFileSync(scriptSource, target);
  return target;
}

function launcherContent(scriptPath, execPath) {
  if (process.platform === 'win32') {
    return `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${execPath}" "${scriptPath}" %*\r\n`;
  }
  return `#!/usr/bin/env bash\nexport ELECTRON_RUN_AS_NODE=1\nexec "${execPath}" "${scriptPath}" "$@"\n`;
}

function writeLauncher(scriptPath, dataDir, execPath) {
  const file = process.platform === 'win32'
    ? path.join(dataDir, 'odm-native-host.cmd')
    : path.join(dataDir, 'odm-native-host.sh');
  fs.writeFileSync(file, launcherContent(scriptPath, execPath));
  if (process.platform !== 'win32') fs.chmodSync(file, 0o755);
  return file;
}

function manifest(launcher) {
  return {
    name: HOST_NAME,
    description: 'ODM browser integration',
    path: launcher,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function installDarwinLinux(manifestPath) {
  const home = os.homedir();
  const installed = [];
  const targets = BROWSER_PATHS[process.platform] || {};
  for (const paths of Object.values(targets)) {
    for (const rel of paths) {
      const file = path.join(home, rel, `${HOST_NAME}.json`);
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.copyFileSync(manifestPath, file);
        installed.push(file);
      } catch {}
    }
  }
  return installed;
}

function installWindows(manifestPath) {
  const installed = [];
  for (const key of Object.values(WINDOWS_REGISTRY)) {
    const target = `${key}\\${HOST_NAME}`;
    try {
      execFileSync('reg', ['add', target, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], { stdio: 'ignore' });
      installed.push(target);
    } catch {}
  }
  return installed;
}

function install({ scriptPath, dataDir, execPath }) {
  if (!fs.existsSync(scriptPath)) throw new Error(`native host script missing: ${scriptPath}`);
  fs.mkdirSync(dataDir, { recursive: true });
  const script = copyScript(scriptPath, dataDir);
  const launcher = writeLauncher(script, dataDir, execPath || process.execPath);
  const manifestPath = path.join(dataDir, `${HOST_NAME}.json`);
  writeJson(manifestPath, manifest(launcher));
  const installed = process.platform === 'win32' ? installWindows(manifestPath) : installDarwinLinux(manifestPath);
  return { manifestPath, installed, extensionId: EXTENSION_ID, hostName: HOST_NAME };
}

module.exports = { install, HOST_NAME, EXTENSION_ID };
