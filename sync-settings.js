// sync-settings.js
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'settings.json');
const destination = path.join(__dirname, 'assets', 'settings.json');

try {
    // Cek apakah file source ada
    if (!fs.existsSync(source)) {
        console.error('❌ Error: settings.json tidak ditemukan di root folder!');
        process.exit(1);
    }

    // Pastikan folder assets ada
    const assetsDir = path.join(__dirname, 'assets');
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        console.log('📁 Folder assets/ dibuat');
    }

    // Copy file
    fs.copyFileSync(source, destination);
    
    // Verifikasi file hasil copy
    const sourceSize = fs.statSync(source).size;
    const destSize = fs.statSync(destination).size;
    
    if (sourceSize === destSize) {
        console.log('✅ settings.json berhasil di-sync ke assets/');
        console.log(`📊 Size: ${(sourceSize / 1024).toFixed(2)} KB`);
    } else {
        console.error('⚠️  Warning: File size tidak sama!');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Error saat sync settings.json:', error.message);
    process.exit(1);
}
