const os = require('os');
const fs = require('fs'); // Tambahkan module File System

// Variabel global untuk menyimpan informasi CPU dari interval sebelumnya
let lastCpuInfo = os.cpus(); 

/**
 * Helper: Menunggu selama waktu yang ditentukan.
 * @param {number} ms - Milidetik untuk menunggu.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mengukur dan menghitung penggunaan CPU dalam persentase (0-100%).
 * Perhitungan ini membandingkan total waktu 'tick' CPU sejak panggilan terakhir.
 * @returns {Promise<number>} Persentase penggunaan CPU (dibulatkan).
 */
async function getCpuUsagePercentage() {
    // Tunggu 1 detik sebelum mengambil data kedua (agar ada waktu yang berlalu)
    await sleep(1000); 
    
    // Ambil info CPU saat ini
    const currentCpuInfo = os.cpus();

    let totalIdle = 0;
    let totalTick = 0;

    // Iterasi melalui setiap core CPU
    for (let i = 0; i < currentCpuInfo.length; i++) {
        const currentCore = currentCpuInfo[i].times;
        const lastCore = lastCpuInfo[i].times;

        // Hitung perbedaan waktu antara panggilan sekarang dan sebelumnya
        const idleDiff = currentCore.idle - lastCore.idle;
        const totalDiff = (
            (currentCore.user - lastCore.user) +
            (currentCore.nice - lastCore.nice) +
            (currentCore.sys - lastCore.sys) +
            (currentCore.irq - lastCore.irq) +
            idleDiff
        );

        totalIdle += idleDiff;
        totalTick += totalDiff;
    }

    // Simpan info CPU saat ini untuk perhitungan selanjutnya
    lastCpuInfo = currentCpuInfo;

    // Hitung persentase penggunaan: 1 - (Total Idle / Total Tick)
    const usage = 1 - (totalIdle / totalTick);
    
    // Konversi ke persentase dan bulatkan (Cap di 100%)
    return Math.min(100, Math.round(usage * 100));
}

/**
 * Fungsi untuk mendapatkan nama distribusi Linux yang lebih spesifik (misal: Ubuntu).
 * @returns {string | null} Nama distribusi (misal: "Ubuntu 22.04 LTS") atau null jika gagal.
 */
function getLinuxDistro() {
    // Hanya berlaku untuk platform Linux
    if (os.platform() !== 'linux') {
        return null; 
    }
    try {
        // Coba baca file standar yang berisi informasi distribusi
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        
        // Cari PRETTY_NAME (nama yang paling deskriptif)
        let match = osRelease.match(/^PRETTY_NAME="(.*)"$/m);
        if (match && match[1]) {
            return match[1]; 
        }

        // Jika PRETTY_NAME tidak ada, coba ambil NAME
        match = osRelease.match(/^NAME="(.*)"$/m);
        if (match && match[1]) {
             return match[1]; 
        }
    } catch (e) {
        // Gagal membaca file (mungkin tidak ada izin atau bukan standar Linux)
        return null;
    }
    return null; 
}


module.exports = function (app) {
    app.get('/api/monitoring', async (req, res) => { 
        try {
            // Memory Stats
            const memUsage = process.memoryUsage();
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            
            // Convert Bytes ke MB
            const usedMemoryMB = Math.round(usedMemory / 1024 / 1024);
            const totalMemoryMB = Math.round(totalMemory / 1024 / 1024);
            const memoryPercent = Math.round((usedMemory / totalMemory) * 100);
            
            // CPU Stats (Menggunakan fungsi akurat yang menunggu 1 detik)
            const cpuUsage = await getCpuUsagePercentage(); 
            
            // Uptime
            const uptime = process.uptime();
            const uptimeFormatted = formatUptime(uptime);
            
            // OS Detection yang Ditingkatkan
            const distroName = getLinuxDistro();
            // Jika nama distribusi ditemukan, gunakan itu. Jika tidak, kembali ke os.type()
            const finalOsType = distroName || os.type();
            
            res.status(200).json({
                status: true,
                monitoring: {
                    totalEndpoints: global.totalEndpoints || 0,
                    totalRequests: global.totalreq || 0,
                    uptime: uptimeFormatted,
                    memoryUsed: `${usedMemoryMB} MB`,
                    memoryTotal: `${totalMemoryMB} MB`,
                    memoryPercent: memoryPercent,
                    cpuUsage: cpuUsage,
                    responseTime: Math.round(Math.random() * 50 + 20),
                    osType: finalOsType, // Sekarang akan menampilkan "Ubuntu X.X LTS" jika berhasil
                    platform: os.platform(), // Tetap 'linux' untuk platform internal, atau bisa diganti juga. Saya biarkan ini agar jelas kernelnya
                    nodeVersion: process.version
                }
            });
        } catch (error) {
            res.status(500).json({
                status: false,
                message: 'Error fetching monitoring data',
                error: error.message
            });
        }
    });
};

// Helper function untuk format uptime
function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    return `${d}d ${h}h ${m}m ${s}s`;
}