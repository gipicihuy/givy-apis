/* File: src/api/tools/spamngl.js */
/* Creator: JawirDev, Modified for API by Givy */
const axios = require('axios');
const crypto = require('crypto');

/**
 * Fungsi untuk generate random string
 * @param {number} length - Panjang string yang dihasilkan
 */
function randomString(length) {
    // Menggunakan Math.random jika crypto gagal (fall back)
    try {
        return crypto.randomBytes(length).toString('hex').slice(0, length);
    } catch (e) {
        return Math.random().toString(36).substring(2, 2 + length);
    }
}

/**
 * Fungsi untuk mengirim satu pesan ke NGL
 * @param {string} username - Username target NGL
 * @param {string} message - Pesan yang akan dikirim
 */
async function sendNGLMessage(username, message) {
    try {
        const deviceId = randomString(21);
        const url = 'https://ngl.link/api/submit';
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': `https://ngl.link/${username}`,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        };
        
        const body = `username=${encodeURIComponent(username)}&question=${encodeURIComponent(message)}&deviceId=${deviceId}&gameSlug=&referrer=`;
        
        const response = await axios.post(url, body, { 
            headers,
            timeout: 10000,
            validateStatus: function (status) {
                return status >= 200 && status < 300;
            }
        });
        
        return response.status === 200;
    } catch (error) {
        // Matikan console.error di sini agar log VPS tidak terlalu penuh
        return false;
    }
}

/**
 * Fungsi utama untuk spam NGL
 * @param {string} username - Username target NGL
 * @param {string} message - Pesan yang akan dikirim
 * @param {number} count - Jumlah pesan yang akan dikirim
 */
async function nglSpam(username, message, count) {
    if (!username || !message || count <= 0) {
        return { error: 'Username, pesan, dan jumlah wajib diisi dengan benar.' };
    }

    try {
        let successCount = 0;
        const results = [];
        const startTime = Date.now(); 

        for (let i = 0; i < count; i++) {
            const success = await sendNGLMessage(username, message);
            if (success) {
                successCount++;
            }
            results.push({
                attempt: i + 1,
                status: success ? 'Berhasil' : 'Gagal'
            });
            
            // Delay 500ms antar request
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

        return {
            target: username,
            message: message,
            totalAttempt: count,
            successCount: successCount,
            failCount: count - successCount,
            successRate: `${((successCount / count) * 100).toFixed(2)}%`,
            duration: `${durationSeconds}s`,
            details: results
        };

    } catch (error) {
        console.error('NGL Spam Service Error:', error.message);
        return { error: 'Kesalahan saat memproses spam NGL.' };
    }
}

// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    const CREATOR_NAME = "Givy";
    const MAX_COUNT = 30; // <<< BATASAN 30 DARI USER

    app.get('/tools/spamngl', async (req, res) => {
        const { username, message, count } = req.query;
        
        if (!username || !message || !count) {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: `Parameter 'username', 'message', dan 'count' wajib diisi. Contoh: /tools/spamngl?username=jawirdev&message=Gacor&count=5`
            });
        }

        const numCount = parseInt(count);
        
        if (isNaN(numCount) || numCount <= 0) {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'count' harus berupa angka positif."
            });
        }

        // IMPLEMENTASI BATAS 30 PESAN
        if (numCount > MAX_COUNT) {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: `Jumlah maksimal spam dibatasi hingga ${MAX_COUNT} pesan per eksekusi.`
            });
        }

        try {
            const result = await nglSpam(username, message, numCount);
            
            if (result.error) {
                return res.status(500).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: result.error
                });
            }
            
            // Sukses - kembalikan hasil spam
            res.json({
                status: true,
                creator: CREATOR_NAME,
                result: result
            });
        } catch (error) {
            console.error("Unhandled error in /tools/spamngl:", error);
            res.status(500).json({
                status: false,
                creator: CREATOR_NAME,
                message: error.message || 'Terjadi kesalahan internal pada server.'
            });
        }
    });
};