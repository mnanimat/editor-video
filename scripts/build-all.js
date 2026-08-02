#!/usr/bin/env node
/**
 * CineForge Pro — Full Build Script
 * Prepares the project for EXE (Electron), Web (PWA), and Android Studio APK.
 * 
 * Usage:
 *   node scripts/build-all.js           → Build everything
 *   node scripts/build-all.js --exe     → Only EXE
 *   node scripts/build-all.js --web     → Only Web
 *   node scripts/build-all.js --android → Only Android instructions
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const buildAll = args.length === 0;
const buildExe = buildAll || args.includes('--exe');
const buildWeb = buildAll || args.includes('--web');
const buildAndroid = buildAll || args.includes('--android');

function run(cmd, cwd = ROOT) {
  console.log(`\n▶️  ${cmd}`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit', shell: true });
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`);
    process.exit(1);
  }
}

function header(msg) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${msg}`);
  console.log('═'.repeat(60));
}

// ── Step 1: Generate icons ────────────────────────────────────
header('🎨 Gerando Ícones...');
run('node scripts/generate-icons.js');

// ── Step 2: EXE (Electron Builder) ───────────────────────────
if (buildExe) {
  header('🪟 Build: EXE (Windows)');
  run('npx electron-builder --win --x64');
  console.log('\n✅ EXE gerado em: dist/');
  
  const distDir = path.join(ROOT, 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir).filter(f => f.endsWith('.exe'));
    files.forEach(f => console.log(`   📦 ${f}`));
  }
}

// ── Step 3: Web (PWA) ─────────────────────────────────────────
if (buildWeb) {
  header('🌐 Build: Web (PWA)');
  
  const webDist = path.join(ROOT, 'dist', 'web');
  if (!fs.existsSync(webDist)) {
    fs.mkdirSync(webDist, { recursive: true });
  }
  
  // Copy all web assets to dist/web/
  const filesToCopy = ['index.html', 'manifest.json', 'sw.js'];
  filesToCopy.forEach(file => {
    const src = path.join(ROOT, file);
    const dst = path.join(webDist, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`   ✅ Copiado: ${file}`);
    }
  });
  
  // Copy src directory
  copyDir(path.join(ROOT, 'src'), path.join(webDist, 'src'));
  console.log('   ✅ Copiado: src/');
  
  // Copy icons
  if (fs.existsSync(path.join(ROOT, 'icons'))) {
    copyDir(path.join(ROOT, 'icons'), path.join(webDist, 'icons'));
    console.log('   ✅ Copiado: icons/');
  }
  
  console.log(`\n✅ Web build completo em: dist/web/`);
  console.log('   Para servir localmente: npx serve dist/web');
  console.log('   Para deploy: Fazer upload da pasta dist/web/ para qualquer CDN/hosting');
}

// ── Step 4: Android instructions ─────────────────────────────
if (buildAndroid) {
  header('🤖 Android Studio — Instruções de Build APK');
  console.log(`
  Para gerar o APK no Android Studio:

  1. Abra o Android Studio
  2. Selecione "Open an Existing Project"
  3. Navegue até: ${path.join(ROOT, 'android')}
  4. Clique OK e aguarde o Gradle sync

  5. Configure o SDK:
     • File → Project Structure → SDK Location
     • Android SDK: C:\\Users\\<usuario>\\AppData\\Local\\Android\\Sdk

  6. Build APK:
     • Build → Build Bundle(s) / APK(s) → Build APK(s)
     • O APK será gerado em: android/app/build/outputs/apk/debug/

  7. Para APK Release (assinado):
     • Build → Generate Signed Bundle / APK
     • Criar keystore se não tiver
     • Selecionar: APK → Release

  Requisitos:
     • Android Studio Hedgehog (2023.1.1) ou superior
     • Android SDK API 34 (Android 14)
     • Gradle 8.x (configurado automaticamente)
     • JDK 17 (bundled com Android Studio)
  `);
}

// ── Helpers ───────────────────────────────────────────────────
function copyDir(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

header('🎬 CineForge Pro — Build Completo!');
console.log(`
  Outputs:
  ${buildExe ? '✅ EXE Windows: dist/CineForge-Pro-Setup-*.exe' : ''}
  ${buildWeb ? '✅ Web (PWA):   dist/web/' : ''}
  ${buildAndroid ? '✅ Android:     android/ (abrir no Android Studio)' : ''}
`);
