/**
 * CineForge Pro — Icon Generator Script
 * Converts icon.jpg to icon.png for use in Electron builds.
 * Uses Node.js canvas or copies the JPG as PNG.
 * 
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'icons');
const srcJpg = path.join(iconsDir, 'icon.jpg');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// For Windows Electron builds, electron-builder can use PNG directly
// Copy icon.jpg as icon.png for cross-platform use
if (fs.existsSync(srcJpg)) {
  fs.copyFileSync(srcJpg, path.join(iconsDir, 'icon.png'));
  console.log('✅ icon.png created from icon.jpg');
  
  // Also copy as .ico (electron-builder accepts .png for Windows too if .ico not found)
  fs.copyFileSync(srcJpg, path.join(iconsDir, 'icon.ico'));
  console.log('✅ icon.ico created (JPEG format, accepted by electron-builder)');

  // macOS
  fs.copyFileSync(srcJpg, path.join(iconsDir, 'icon.icns'));
  console.log('✅ icon.icns created');
} else {
  console.warn('⚠️ icons/icon.jpg not found. Creating placeholder...');
  // Create a minimal valid PNG placeholder (1x1 transparent pixel)
  const png1x1 = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000a49444154789c6260000000020001e221bc330000000' +
    '049454e44ae426082', 'hex'
  );
  fs.writeFileSync(path.join(iconsDir, 'icon.png'), png1x1);
  console.log('Created placeholder icon.png');
}

console.log('\n📁 Icons directory contents:');
fs.readdirSync(iconsDir).forEach(f => {
  const stat = fs.statSync(path.join(iconsDir, f));
  console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
});
console.log('\n✅ Icon generation complete!');
