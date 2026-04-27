import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const isWindows = process.platform === 'win32';
const ci = process.argv.includes('--ci');
const validTargets = new Map([
  ['1', 'dmg'],
  ['2', 'exe'],
  ['3', 'linux'],
  ['dmg', 'dmg'],
  ['mac', 'dmg'],
  ['macos', 'dmg'],
  ['exe', 'exe'],
  ['win', 'exe'],
  ['windows', 'exe'],
  ['linux', 'linux'],
  ['appimage', 'linux'],
]);
const targetInfo = {
  dmg: { platform: 'darwin', label: '.dmg para macOS', desktopScript: 'dist:mac' },
  exe: { platform: 'win32', label: '.exe para Windows', desktopScript: 'dist:win' },
  linux: { platform: 'linux', label: 'AppImage para Linux', desktopScript: 'dist:linux' },
};

function commandName(name) {
  return isWindows ? `${name}.cmd` : name;
}

function exitWith(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    shell: isWindows,
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (result.error) {
    if (options.allowFailure) return result;
    exitWith(`Falha ao executar ${command}: ${result.error.message}`);
  }

  if (result.status !== 0 && !options.allowFailure) {
    exitWith(`Comando falhou: ${command} ${args.join(' ')}`);
  }

  return result;
}

function ensureCommand(command, message) {
  const checker = isWindows ? 'where' : 'which';
  const args = [command];
  const result = run(checker, args, { capture: true, allowFailure: true });
  if (result.status !== 0) exitWith(message);
}

function ensurePath(path, message) {
  if (!existsSync(path)) exitWith(message);
}

function requireNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  if (Number.isNaN(major) || major < 20) {
    exitWith(`Node.js 20 ou maior e necessario. Versao atual: ${process.version}`);
  }
}

function javaVersionText() {
  const result = run('java', ['-version'], { capture: true, allowFailure: true });
  if (result.status !== 0) return '';
  return `${result.stderr ?? ''}${result.stdout ?? ''}`;
}

function ensureJava() {
  const text = javaVersionText();
  if (!text) exitWith('Java/JDK nao encontrado. Instale JDK 17 ou maior antes de rodar o build.');
  const match = text.match(/version "(\d+)(?:\.|")/);
  const major = match ? Number(match[1]) : 0;
  if (!major || major < 17) exitWith(`JDK 17 ou maior e necessario. Detectado:\n${text.trim()}`);
  const javac = run('javac', ['-version'], { capture: true, allowFailure: true });
  if (javac.status !== 0) exitWith('JDK incompleto. O comando javac nao foi encontrado.');
}

function resolveJavaHome() {
  const envHome = process.env.JAVA_HOME;
  if (envHome && existsSync(join(envHome, 'bin', isWindows ? 'java.exe' : 'java'))) return envHome;
  if (process.platform === 'darwin') {
    const result = run('/usr/libexec/java_home', ['-v', '17+'], { capture: true, allowFailure: true });
    const home = result.stdout?.trim();
    if (result.status === 0 && home && existsSync(join(home, 'bin', 'java'))) return home;
  }
  return '';
}

function ensureBundledJdk() {
  const bundled = join(rootDir, 'resources', 'jdk');
  const javaBinary = join(bundled, 'bin', isWindows ? 'java.exe' : 'java');
  const shouldRefresh = ci || !existsSync(javaBinary);
  if (!shouldRefresh) return;

  const javaHome = resolveJavaHome();
  if (!javaHome) exitWith('Nao consegui localizar JAVA_HOME para embutir o JDK no app.');

  console.log(`\nPreparando JDK embutido: ${javaHome}`);
  rmSync(bundled, { recursive: true, force: true });
  mkdirSync(dirname(bundled), { recursive: true });
  cpSync(javaHome, bundled, { recursive: true, dereference: false, verbatimSymlinks: true });
  ensurePath(javaBinary, 'JDK embutido foi copiado, mas o executavel java nao foi encontrado.');
}

function ensureProject() {
  ensurePath(join(rootDir, 'backend', isWindows ? 'gradlew.bat' : 'gradlew'), 'Gradle wrapper do backend nao encontrado.');
  ensurePath(join(rootDir, 'frontend', 'package.json'), 'package.json do frontend nao encontrado.');
  ensurePath(join(rootDir, 'frontend', 'package-lock.json'), 'package-lock.json do frontend nao encontrado.');
  ensurePath(join(rootDir, 'odm-desktop', 'package.json'), 'package.json do desktop nao encontrado.');
  ensurePath(join(rootDir, 'odm-desktop', 'package-lock.json'), 'package-lock.json do desktop nao encontrado.');
}

function ensurePlatform(target) {
  const expected = targetInfo[target].platform;
  if (process.platform !== expected) {
    const current = `${process.platform}/${process.arch}`;
    exitWith(`Este build precisa rodar em ${expected}. Sistema atual: ${current}. Use GitHub Actions para gerar Windows/Linux fora da maquina correta.`);
  }
}

function ensurePlatformTools(target) {
  if (target === 'dmg') {
    ensureCommand('hdiutil', 'hdiutil nao encontrado. .dmg so pode ser gerado no macOS.');
    ensureCommand('codesign', 'codesign nao encontrado. Instale as ferramentas de linha de comando da Apple.');
  }
}

function installDependencies(folder, label) {
  const nodeModules = join(rootDir, folder, 'node_modules');
  if (!ci && existsSync(nodeModules)) return;
  console.log(`\nInstalando dependencias: ${label}`);
  run(commandName('npm'), ['ci', '--no-audit', '--no-fund'], { cwd: join(rootDir, folder) });
}

function newestJar() {
  const libs = join(rootDir, 'backend', 'build', 'libs');
  const jars = readdirSync(libs)
    .filter((file) => file.endsWith('.jar') && !file.endsWith('-plain.jar'))
    .map((file) => join(libs, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!jars.length) exitWith('Backend buildou, mas nenhum jar executavel foi encontrado.');
  return jars[0];
}

function copyFrontend() {
  const source = join(rootDir, 'frontend', 'dist', 'frontend', 'browser');
  const target = join(rootDir, 'odm-desktop', 'app');
  ensurePath(join(source, 'index.html'), 'Frontend buildou, mas index.html nao foi encontrado.');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

function copyBackendJar() {
  const jar = newestJar();
  const targetDir = join(rootDir, 'resources', 'backend');
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(jar, join(targetDir, 'odm-backend.jar'));
}

function verifyStagedApp() {
  ensurePath(join(rootDir, 'odm-desktop', 'app', 'index.html'), 'Frontend nao foi copiado para o app desktop.');
  ensurePath(join(rootDir, 'resources', 'backend', 'odm-backend.jar'), 'Backend jar nao foi copiado para resources/backend.');
  ensureBundledJdk();
}

function artifactExt(target) {
  if (target === 'dmg') return '.dmg';
  if (target === 'exe') return '.exe';
  return '.AppImage';
}

function listArtifacts(target) {
  const dist = join(rootDir, 'odm-desktop', 'dist');
  if (!existsSync(dist)) return [];
  return readdirSync(dist)
    .filter((file) => file.startsWith('ODM-') && file.endsWith(artifactExt(target)))
    .map((file) => join(dist, file))
    .sort();
}

async function chooseTarget() {
  const rawArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  const direct = rawArg ? validTargets.get(rawArg.toLowerCase()) : '';
  if (direct) return direct;
  if (ci) exitWith('Informe o formato no CI: dmg, exe ou linux.');

  const rl = readline.createInterface({ input, output });
  console.log('\nQual formato voce quer gerar?');
  console.log('1. .dmg para macOS');
  console.log('2. .exe para Windows');
  console.log('3. AppImage para Linux');
  const answer = (await rl.question('\nDigite 1, 2, 3 ou o nome do formato: ')).trim().toLowerCase();
  rl.close();
  const target = validTargets.get(answer);
  if (!target) exitWith('Formato invalido. Use dmg, exe ou linux.');
  return target;
}

async function main() {
  const target = await chooseTarget();
  const info = targetInfo[target];

  console.log(`\nBuild selecionado: ${info.label}`);
  ensurePlatform(target);
  ensurePlatformTools(target);
  requireNodeVersion();
  ensureCommand('npm', 'npm nao encontrado. Instale Node.js 20 ou maior.');
  ensureJava();
  ensureProject();

  if (!isWindows) run('chmod', ['+x', './gradlew'], { cwd: join(rootDir, 'backend') });

  installDependencies('frontend', 'frontend');
  installDependencies('odm-desktop', 'desktop');

  console.log('\nBuildando backend');
  run(isWindows ? 'gradlew.bat' : './gradlew', ['--no-daemon', 'bootJar', '-x', 'test'], { cwd: join(rootDir, 'backend') });
  copyBackendJar();

  console.log('\nBuildando frontend');
  run(commandName('npm'), ['run', 'build'], { cwd: join(rootDir, 'frontend') });
  copyFrontend();
  verifyStagedApp();

  console.log('\nGerando instalador');
  const env = target === 'dmg' && !process.env.CSC_LINK
    ? { CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
    : {};
  run(commandName('npm'), ['run', info.desktopScript, '--', '--publish', 'never'], {
    cwd: join(rootDir, 'odm-desktop'),
    env,
  });

  const artifacts = listArtifacts(target);
  if (!artifacts.length) exitWith('Build terminou, mas nenhum instalador esperado foi encontrado.');
  console.log('\nPronto. Arquivo gerado:');
  for (const artifact of artifacts) console.log(artifact);
}

main().catch((error) => exitWith(error?.message ?? String(error)));
