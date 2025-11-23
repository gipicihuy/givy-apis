const axios = require('axios');
const CREATOR_NAME = "Givy";

// URL DATASET AMBATIVASI DARI GITHUB (Gunakan format yang disederhanakan)
const DATASET_URL = 'https://raw.githubusercontent.com/gipicihuy/givy/refs/heads/main/ambativasi.json'; 

// Cache untuk menyimpan data
let cachedAmbativasiData = [];
let isInitialized = false;


/**
 * Memuat data dari URL eksternal dan menyimpannya ke cache.
 */
async function loadRemoteData() {
    try {
        console.log(`[AMBATIVASI] Mencoba memuat data dari Host: ${DATASET_URL}`);
        
        const response = await axios.get(DATASET_URL, { timeout: 15000 });
        const rawData = response.data;

        let motivasiArray = null;

        // KASUS 1: Struktur yang BENAR (Objek dengan key 'ambativasi')
        if (typeof rawData === 'object' && rawData !== null && Array.isArray(rawData.ambativasi)) {
            motivasiArray = rawData.ambativasi;
            
        // KASUS 2: Struktur alternatif (Array langsung, sebagai fallback)
        } else if (Array.isArray(rawData)) {
             motivasiArray = rawData;
             
        } else {
            // Jika tidak ada array yang ditemukan sama sekali, lempar error
            throw new Error(`Data tidak valid. Tipe data: ${typeof rawData}. Pastikan file berisi {"ambativasi": [...]}`);
        }

        // Filter dan simpan data yang memiliki properti 'text'
        cachedAmbativasiData = motivasiArray.filter(item => item && item.text);
        
        isInitialized = true;
        
        if (cachedAmbativasiData.length === 0) {
             throw new Error("Data berhasil diakses, tetapi tidak ada kutipan yang valid ditemukan.");
        }
        
        console.log(`[AMBATIVASI] Total ${cachedAmbativasiData.length} kutipan dimuat ke memori dari Host.`);
        return true;

    } catch (error) {
        // Log error yang lebih detail untuk diagnosis
        const status = error.response ? `Status ${error.response.status}` : 'NETWORK_ERROR';
        console.error(`[AMBATIVASI ERROR] Gagal memuat dataset dari Host. Detail: ${error.message} (${status})`);
        
        isInitialized = true;
        cachedAmbativasiData = [];
        return false;
    }
}

// Panggil saat modul dimuat (Cold Start)
loadRemoteData();


function getAmbativasiById(id) {
    // Cari kutipan berdasarkan ID
    return cachedAmbativasiData.find(item => item.id === id);
}

function getRandomAmbativasi() {
    // Pilih kutipan secara acak
    const randomIndex = Math.floor(Math.random() * cachedAmbativasiData.length); 
    return cachedAmbativasiData[randomIndex];
}

// Handler Express
module.exports = function(app) {
    
    // Endpoint: GET /random/ambativasi
    app.get('/random/ambativasi', async (req, res) => {
        const { id } = req.query; 

        if (!isInitialized || cachedAmbativasiData.length === 0) {
            // Coba muat ulang jika ada kegagalan saat cold start
            if (!isInitialized) {
                 await loadRemoteData(); 
            }
             
            if (cachedAmbativasiData.length === 0) {
                // Pesan Error yang diubah agar lebih informatif
                return res.status(503).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: "Layanan Ambativasi Belum Siap. Dataset gagal dimuat dari GitHub. Cek log server untuk detail."
                });
            }
        }
        
        let selectedData = null;
        let queryMode = 'random';
        
        if (id) {
            const parsedId = parseInt(id);
            if (!isNaN(parsedId)) {
                selectedData = getAmbativasiById(parsedId);
                queryMode = 'by_id';
            }
        }
        
        if (!selectedData) {
            selectedData = getRandomAmbativasi();
            queryMode = (queryMode === 'by_id' ? 'fallback_random' : 'random');
        }
        
        if (selectedData) {
            
            return res.status(200).json({
                status: true,
                creator: CREATOR_NAME,
                mode: queryMode,
                id: selectedData.id, 
                ambativasi: selectedData.text,
                by: selectedData.by || 'Anonim'
            });
        } else {
            return res.status(500).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Internal Server Error: Gagal mendapatkan kutipan ambativasi."
            });
        }
    });
};