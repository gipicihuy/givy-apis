const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

// Memuat fungsi global (runtime, fetchJson, dll.) dari function.js
require("./function.js"); 

const app = express();
const PORT = process.env.PORT || 8080;

// =========================================================================================================
// KONFIGURASI WEBHOOK DISCORD
// Ganti webhook Discord lu disini:
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1428758998420684806/FaQk3iAXjQf5lgn7m_yB-QVqskpj_y_F9FWGTYCJNQU1DZPP8gIId1qOO3S0f4xJD1mQ';

// Buffer untuk batch log
let logBuffer = [];
let requestCount = 0;
let cooldownActive = false;
let totalRoutes = 0; // Inisialisasi penghitung rute

// =========================================================================================================
// LOGGING & COOLDOWN MECHANISM

// Function log queue
function queueLog({ method, status, url, duration, error = null }) {
    let colorCode;
    if (status >= 500) colorCode = '[2;31m';
    else if (status >= 400) colorCode = '[2;31m';
    else if (status === 304) colorCode = '[2;34m';
    else if (status >= 200 && status < 300) colorCode = '[2;32m';
    else colorCode = '[2;33m';

    const logMessage = `\u001b[38;5;250m[${new Date().toISOString().slice(11, -1)}] \u001b[0m\u001b${colorCode}${method} \u001b[0m\u001b[2;37m${url} \u001b[0m\u001b${colorCode}${status}\u001b[0m \u001b[38;5;250m| ${duration}ms\u001b[0m`;

    logBuffer.push(logMessage);
}

// Kirim batch log tiap 2 detik
setInterval(() => {
    if (logBuffer.length === 0) return;

    const combinedLogs = logBuffer.join('\n');
    logBuffer = [];

    const payload =
` \`\`\`ansi
${combinedLogs}
\`\`\`
`;

    axios.post(WEBHOOK_URL, { content: payload }).catch(console.error);
}, 2000);

// Reset request count setiap detik
setInterval(() => {
    requestCount = 0;
}, 1000);

// =========================================================================================================
// MIDDLEWARE & GLOBAL SETTINGS

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware untuk mencatat waktu mulai request
app.use((req, res, next) => {
    req.start = Date.now();
    next();
});

app.use('/src', express.static(path.join(__dirname, 'src'))); 
app.use('/assets', express.static(path.join(__dirname, 'assets'))); 

// Memuat settings.json dari ROOT untuk konfigurasi global
try {
    const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
    global.apikey = settings.apiSettings.apikey;
    global.creator = settings.apiSettings.creator;
    global.totalreq = 0; // Inisialisasi global request count
    console.log(chalk.bgGreen.hex('#333').bold(' API Key Loaded! '));
} catch (e) {
    console.error(chalk.bgRed.hex('#fff').bold(' FAILED TO LOAD settings.json (root)! '), e.message);
}


// Cooldown Middleware (Rate Limiter)
app.use((req, res, next) => {
    if (cooldownActive) {
        return res.status(503).json({
            status: false,
            message: "API sedang dalam masa cooldown (overload request). Silakan coba lagi sebentar lagi.",
            cooldownUntil: new Date(cooldownActive).toISOString()
        });
    }

    requestCount++;
    global.totalreq++;

    if (requestCount > 10 && !cooldownActive) {
        // ACTIVATE COOLDOWN
        const cooldownTime = Math.floor(Math.random() * (120000 - 60000 + 1) + 60000); // 60s to 120s
        cooldownActive = Date.now() + cooldownTime;

        // NOTIFIKASI WEBHOOK
        const cooldownPayload = `\`\`\`ansi\n\u001b[2;31m[CRITICAL] \u001b[0mAPI masuk mode COOLDOWN! Request per detik: ${requestCount}. Cooldown selama ${Math.floor(cooldownTime / 1000)} detik.\n\`\`\``;
        axios.post(WEBHOOK_URL, { content: cooldownPayload }).catch(console.error);

        console.log(chalk.bgRed.hex('#fff').bold(` API COOLDOWN: ${Math.floor(cooldownTime / 1000)}s`));
        
        // Atur timer untuk menonaktifkan cooldown
        setTimeout(() => {
            cooldownActive = false;
            const resumePayload = `\`\`\`ansi\n\u001b[2;32m[INFO] \u001b[0mAPI keluar dari mode COOLDOWN. Server kembali normal.\n\`\`\``;
            axios.post(WEBHOOK_URL, { content: resumePayload }).catch(console.error);
            console.log(chalk.bgGreen.hex('#333').bold(' API COOLDOWN ENDED. '));
        }, cooldownTime);

        // Langsung hentikan request saat ini
        return res.status(503).json({
            status: false,
            message: "API masuk mode cooldown (overload request). Silakan coba lagi sebentar lagi.",
            cooldownUntil: new Date(cooldownActive).toISOString()
        });
    }
    
    next();
});

// Middleware untuk mencatat waktu respons
app.use((req, res, next) => {
    res.on('finish', () => {
        const duration = Date.now() - req.start;
        queueLog({
            method: req.method,
            status: res.statusCode,
            url: req.originalUrl,
            duration: duration
        });
    });
    next();
});

// =========================================================================================================
// MUAT RUTE SECARA DINAMIS DARI FOLDER src/api/

const apiFolder = path.join(__dirname, 'src', 'api');
console.log(chalk.bgCyan.hex('#333').bold(' Loading Routes... '));

fs.readdirSync(apiFolder).forEach((subfolder) => {
    const subfolderPath = path.join(apiFolder, subfolder);
    if (fs.statSync(subfolderPath).isDirectory()) {
        fs.readdirSync(subfolderPath).forEach((file) => {
            const filePath = path.join(subfolderPath, file);
            if (path.extname(file) === '.js') {
                require(filePath)(app);
                totalRoutes++;
                console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Loaded Route: ${path.basename(file)} `));
            }
        });
    }
});

console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Load Complete! ✓ '));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Routes Loaded: ${totalRoutes} `));

// =========================================================================================================
// RUTE SPESIAL & DOKUMENTASI

// RUTE BARU: Menyajikan konfigurasi dokumentasi dari file root settings.json
// index.html akan mengambil data dari sini.
app.get('/api/config', (req, res) => {
    const configPath = path.join(__dirname, 'settings.json'); // Path ke settings.json di ROOT
    
    if (!fs.existsSync(configPath)) {
        return res.status(500).json({ status: false, message: 'File settings.json (root) tidak ditemukan.' });
    }
    
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.send(configData); 
    } catch (error) {
        console.error("Error reading root settings.json for documentation:", error);
        res.status(500).json({ status: false, message: 'Gagal membaca konfigurasi dokumentasi.' });
    }
});

// Index route (Halaman Dokumentasi)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-page', 'index.html'));
});

// =========================================================================================================
// ERROR HANDLERS

// Error handler 404
app.use((req, res, next) => {
    // Log 404 (sudah dicatat oleh finish handler di atas)
    res.status(404).sendFile(path.join(__dirname, "api-page", "404.html"));
});

// Error handler 500 (Catch-all)
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // Kirim respons 500
    res.status(500).sendFile(path.join(__dirname, "api-page", "500.html"));
});

// =========================================================================================================
// START SERVER

app.listen(PORT, () => {
    console.log(chalk.bgBlue.hex('#fff').bold(` Server is running on port ${PORT} `));
});
