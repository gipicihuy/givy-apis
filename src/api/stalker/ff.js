/* File: src/api/stalk/ff.js */
const axios = require('axios'); // Ganti import dengan require
const { v4: uuidv4 } = require('uuid'); // Ganti import dengan require
const moment = require('moment-timezone'); // Tambahkan moment-timezone untuk penanganan waktu yang lebih mudah

const FF_API_BASE = 'https://api.duniagames.co.id/api';

// Fungsi internal untuk mendapatkan token
async function _getToken() {
    try {
        const url = `${FF_API_BASE}/item-catalog/v1/get-token`;
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "X-Device": uuidv4(),
            "Content-Type": "application/json",
        };
        const payload = {"msisdn": "0812665588"}; // Nomor MSISDN ini mungkin perlu diubah jika ada masalah di masa depan
        
        const response = await axios.post(url, payload, { headers, timeout: 10000 });
        const data = response.data;
        
        if (data.status && data.status.code === 0) {
            return data.data?.token;
        }
        return null;
    } catch (e) {
        // console.error("Error _getToken:", e.message); // Untuk debugging
        return null;
    }
}

// Fungsi internal untuk mendapatkan data pemain lengkap
async function _getPlayerFullData(playerId, token) {
    try {
        const url = `${FF_API_BASE}/transaction/v1/top-up/inquiry/store`;
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "X-Device": uuidv4(),
            "Content-Type": "application/json",
        };
        const payload = {
            "productId": 3,
            "itemId": 353,
            "product_ref": "REG",
            "product_ref_denom": "REG",
            "catalogId": 376,
            "paymentId": 1252,
            "gameId": playerId,
            "token": token,
            "campaignUrl": "",
        };
        
        const response = await axios.post(url, payload, { headers, timeout: 10000 });
        const data = response.data;

        if (data.status && data.status.code === 0) {
            return data.data;
        }
        return null;
    } catch (e) {
        // console.error("Error _getPlayerFullData:", e.message); // Untuk debugging
        return null;
    }
}

// Fungsi internal untuk memparsing data
function _parseCompleteData(playerId, fullData) {
    const gameDetail = fullData.gameDetail || {};
    
    // Menggunakan moment-timezone untuk format WIB
    const formattedDate = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
    
    return {
        player_id: playerId,
        nickname: gameDetail.userName || "Unknown",
        server: gameDetail.serverName || "Unknown",
        game: "Free Fire",
        scan_time: formattedDate,
        status: "Active" // Asumsi active jika berhasil discrape
    };
}

// Fungsi utama scraper Free Fire
async function stalkFreeFirePlayer(playerId) {
    if (!playerId) return { error: "Player ID wajib diisi." };

    try {
        const token = await _getToken();
        if (!token) {
            return {"error": "Gagal mendapatkan token (API Gagal Merespon atau Blokir)."};
        }
        
        const fullData = await _getPlayerFullData(playerId, token);
        
        if (fullData && fullData.gameDetail && fullData.gameDetail.userName) {
            // Cek userName untuk memastikan player ditemukan
            return _parseCompleteData(playerId, fullData);
        } else {
            return {"error": "Player tidak ditemukan atau ID tidak valid."};
        }
        
    } catch (error) {
        let errorMsg = 'Kesalahan sistem saat memproses data.';
        if (error.response) {
            // console.error("Error response data:", error.response.data); // Untuk debugging
            errorMsg = `Error API Duniagames: Status ${error.response.status} - ${JSON.stringify(error.response.data)}`;
        } else if (error.request) {
            errorMsg = "Tidak ada respons dari server Duniagames (timeout atau masalah koneksi).";
        } else {
            errorMsg = `Error: ${error.message}`;
        }
        return {"error": errorMsg};
    }
}

// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/stalk/ff', async (req, res) => {
        const { playerid } = req.query; // Ambil parameter 'playerid' dari query URL
        
        if (!playerid) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'playerid' wajib diisi. Contoh: /stalk/ff?playerid=1234567890"
            });
        }
        
        try {
            const result = await stalkFreeFirePlayer(playerid);
            
            if (result.error) {
                // Jika fungsi scraper mengembalikan error
                return res.status(500).json({
                    status: false,
                    creator: 'Givy', // Ganti dengan nama creator Anda jika berbeda
                    message: result.error
                });
            }
            
            // Sukses - kembalikan data pemain Free Fire
            res.json({
                status: true,
                creator: 'Givy', // Ganti dengan nama creator Anda jika berbeda
                result: result
            });
        } catch (error) {
            // Tangani error yang tidak terduga pada layer Express
            console.error("Unhandled error in /stalk/ff:", error); // Log error untuk debugging server
            res.status(500).json({
                status: false,
                message: error.message || 'Terjadi kesalahan internal pada server.'
            });
        }
    });
};
