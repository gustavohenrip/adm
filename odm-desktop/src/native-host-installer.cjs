const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOST_NAME = 'com.odm.bridge';

const BROWSER_PATHS = {
  darwin: {
    chrome: ['Library/Application Support/Google/Chrome/NativeMessagingHosts'],
    chromium: ['Library/Application Support/Chromium/NativeMessagingHosts'],
    edge: ['Library/Application Support/Microsoft Edge/NativeMessagingHosts'],
    brave: ['Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts'],
    firefox: ['Library/Application Support/Mozilla/NativeMessagingHosts'],
  },
  linux: {
    chrome: ['.config/google-chrome/NativeMessagingHosts'],
    chromium: ['.config/chromium/NativeMessagingHosts'],
    edge: ['.config/microsoft-edge/NativeMessagingHosts'],
    brave: ['.config/BraveSoftware/Brave-Browser/NativeMessagingHosts'],
    firefox: ['.mozilla/native-messaging-hosts'],
  },
  win32: {},
};

function copyScript(scriptSource, dataDir) {
  const target = path.join(dataDir, 'odm-native-host.cjs');
  const data = fs.readFileSync(scriptSource);
  fs.writeFileSync(target, data);
  return target;
}

function buildLauncher(scriptPath, execPath) {
  if (process.platform === 'win32') {
    return `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${execPath}" "${scriptPath}" %*\r\n`;
  }
  return `#!/usr/bin/env bash\nexport ELECTRON_RUN_AS_NODE=1\nexec "${execPath}" "${scriptPath}" "$@"\n`;
}

function ensureLauncher(scriptPath, dataDir, execPath) {
  const launcher = process.platform === 'win32'
    ? path.join(dataDir, 'odm-bridge.cmd')
    : path.join(dataDir, 'odm-bridge.sh');
  fs.writeFileSync(launcher, buildLauncher(scriptPath, execPath));
  if (process.platform !== 'win32') fs.chmodSync(launcher, 0o755);
  return launcher;
}

function manifest(extensionId, executable, browser) {
  const base = {
    name: HOST_NAME,
    description: 'ODM browser integration bridge',
    path: executable,
    type: 'stdio',
  };
  if (browser === 'firefox') {
    return { ...base, allowed_extensions: extensionId ? [extensionId] : ['odm@opendownloader'] };
  }
  return {
    ...base,
    allowed_origins: extensionId
      ? [`chrome-extension://${extensionId}/`]
      : ['chrome-extension://*/'],
  };
}

function install({ scriptPath, dataDir, extensionId, execPath }) {
  if (!fs.existsSync(scriptPath)) throw new Error(`native host script missing: ${scriptPath}`);
  fs.mkdirSync(dataDir, { recursive: true });
  const resolvedExec = execPath || process.execPath;
  const localScript = copyScript(scriptPath, dataDir);
  const launcher = ensureLauncher(localScript, dataDir, resolvedExec);
  const home = os.homedir();
  const platformPaths = BROWSER_PATHS[process.platform] || {};
  const installed = [];
  for (const [browser, paths] of Object.entries(platformPaths)) {
    for (const rel of paths) {
      const dir = path.join(home, rel);
      try {
        fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, `${HOST_NAME}.json`);
        fs.writeFileSync(target, JSON.stringify(manifest(extensionId, launcher, browser), null, 2));
        installed.push(target);
      } catch (e) {
        // browser not installed; ignore
      }
    }
  }
  return installed;
}

module.exports = { install, HOST_NAME };
