const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

require("./function.js");

const app = express();
const PORT = process.env.PORT || 3000;

// Ganti webhook Discord lu disini:
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1428758998420684806/FaQk3iAXjQf5lgn7m_yB-QVqskpj_y_F9FWGTYCJNQU1DZPP8gIId1qOO3S0f4xJD1mQ';

// Buffer untuk batch log
let logBuffer = [];

// Kirim batch tiap detik
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

// Function log queue
function queueLog({ method, status, url, duration, error = null }) {
    let colorCode;
    if (status >= 500) colorCode = '[2;31m';
    else if (status >= 400) colorCode = '[2;31m';
    else if (status === 304) colorCode = '[2;34m';
    else colorCode = '[2;32m';

    let line = `${colorCode}[${method}] ${status} ${url} - ${duration}ms[0m`;

    if (error) {
        line += `\n[2;31m[ERROR] ${error.message || error}[0m`;
    }

    logBuffer.push(line);
}

// Blok Cooldown vars dan middleware rate limiting (app.use)
// TELAH DIHAPUS SEPENUHNYA dari sini.

app.enable("trust proxy");
app.set("json spaces", 2);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// Load Settings
const settingsPath = path.join(__dirname, './settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
global.apikey = settings.apiSettings.apikey;
global.totalreq = 0; // Initialize total requests counter
global.totalEndpoints = 0; // Initialize total endpoints counter

// Exclude paths dari request counter (monitoring, assets, dll)
const excludePaths = ['/api/monitoring', '/api/config', '/monitoring', '/dashboard', '/assets'];

// Custom Log + Wrap res.json + Batch log semua response
app.use((req, res, next) => {
    console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Request Route: ${req.path} `));
    
    // Jangan hitung request ke monitoring endpoints
    const isExcluded = excludePaths.some(path => req.path.startsWith(path));
    if (!isExcluded) {
        global.totalreq = (global.totalreq || 0) + 1;
    }

    const start = Date.now();
    const originalJson = res.json;

    res.json = function (data) {
        if (data && typeof data === 'object') {
            const responseData = {
                status: data.status,
                creator: settings.apiSettings.creator || "Eberardos",
                ...data
            };
            return originalJson.call(this, responseData);
        }
        return originalJson.call(this, data);
    };

    res.on('finish', () => {
        const duration = Date.now() - start;

        queueLog({
            method: req.method,
            status: res.statusCode,
            url: req.originalUrl,
            duration
        });
    });

    next();
});

// Serve settings.json untuk web
app.get('/api/config', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.json'));
});

// Static & Src Protect
app.use('/', express.static(path.join(__dirname, 'api-page')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/src', (req, res) => {
    res.status(403).json({ error: 'Forbidden access' });
});

// Load API routes dinamis dari src/api/
let totalRoutes = 0;
const apiFolder = path.join(__dirname, './src/api');
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

// Set global totalEndpoints setelah semua routes loaded
global.totalEndpoints = totalRoutes;

console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Load Complete! ✓ '));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Routes Loaded: ${totalRoutes} `));

// Index route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-page', 'index.html'));
});

// Monitoring page route
app.get('/monitoring', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-page', 'monitoring.html'));
});

// Dashboard page route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-page', 'monitoring.html'));
});

// Error handler 404 & 500 + batch log
app.use((req, res, next) => {
    queueLog({
        method: req.method,
        status: 404,
        url: req.originalUrl,
        duration: 0,
        error: 'Not Found'
    });

    res.status(404).sendFile(process.cwd() + "/api-page/404.html");
});

app.use((err, req, res, next) => {
    console.error(err.stack);

    queueLog({
        method: req.method,
        status: 500,
        url: req.originalUrl,
        duration: 0,
        error: err
    });

    res.status(500).sendFile(process.cwd() + "/api-page/500.html");
});

app.listen(PORT, () => {
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
});

module.exports = app;