const axios = require('axios');
const CREATOR_NAME = "Givy";

// URL DATASET MOTIVASI DARI GITHUB
const DATASET_URL = 'https://raw.githubusercontent.com/gipicihuy/givy/refs/heads/main/motivasi.json'; 

// Cache untuk menyimpan data
let cachedMotivasiData = [];
let isInitialized = false;


/**
 * Memuat data dari URL eksternal dan menyimpannya ke cache.
 * Dataset Motivasi berbentuk Array di bawah key "motivasi", jadi perlu parsing khusus.
 */
async function loadRemoteData() {
    try {
        console.log(`[MOTIVASI] Mencoba memuat data dari Host: ${DATASET_URL}`);
        
        const response = await axios.get(DATASET_URL, { timeout: 15000 });
        const rawData = response.data; // Data sudah berupa objek JSON

        if (rawData && Array.isArray(rawData.motivasi)) {
             // Langsung ambil array "motivasi"
            cachedMotivasiData = rawData.motivasi.filter(item => item && item.teks);
        } else {
            throw new Error("Struktur JSON tidak valid atau tidak memiliki key 'motivasi'.");
        }
        
        isInitialized = true;
        
        if (cachedMotivasiData.length === 0) {
             throw new Error("Data berhasil diakses, tetapi tidak ada kutipan yang valid ditemukan.");
        }
        
        console.log(`[MOTIVASI] Total ${cachedMotivasiData.length} kutipan dimuat ke memori dari Host.`);
        return true;

    } catch (error) {
        console.error(`[MOTIVASI ERROR] Gagal memuat dataset dari Host: ${error.message}`);
        isInitialized = true;
        cachedMotivasiData = [];
        return false;
    }
}

// Panggil saat modul dimuat (Cold Start)
loadRemoteData();


async function getRandomMotivasi() {
    if (cachedMotivasiData.length === 0) {
        return { code: 503, message: "Dataset Motivasi belum tersedia atau gagal dimuat dari Host." };
    }
    
    // Pilih kutipan secara acak dari cache
    const randomIndex = Math.floor(Math.random() * cachedMotivasiData.length); 
    const randomKutipan = cachedMotivasiData[randomIndex];

    const resultData = {
        id: randomKutipan.id || randomIndex + 1,
        teks: randomKutipan.teks
    };
    
    return { code: 200, data: resultData };
}

// Handler Express
module.exports = function(app) {
    
    // Endpoint: GET /random/motivasi
    app.get('/random/motivasi', async (req, res) => {
        
        if (!isInitialized || cachedMotivasiData.length === 0) {
            // Coba muat ulang jika ada kegagalan saat cold start
            if (!isInitialized) {
                 await loadRemoteData(); 
            }
             
            if (cachedMotivasiData.length === 0) {
                return res.status(503).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: "Layanan Motivasi Belum Siap. Dataset gagal dimuat dari Host."
                });
            }
        }
        
        const result = await getRandomMotivasi();
        
        if (result.code === 200) {
            
            return res.status(200).json({
                status: true,
                creator: CREATOR_NAME,
                id: result.data.id, 
                motivasi: result.data.teks
            });
        } else {
            return res.status(result.code).json({
                status: false,
                creator: CREATOR_NAME,
                message: result.message
            });
        }
    });
};