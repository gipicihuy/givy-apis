const axios = require('axios');
const CREATOR_NAME = "Givy";

// URL DATASET AMBATIVASI DARI GITHUB
const DATASET_URL = 'https://raw.githubusercontent.com/gipicihuy/givy/refs/heads/main/ambativasi.json'; 

// Cache untuk menyimpan data
let cachedAmbativasiData = [];
let isInitialized = false;

// ===================================
// === FUNGSI UTILITY ===
// ===================================

/**
 * Mendapatkan kutipan ambativasi acak.
 */
function getRandomAmbativasi() {
    if (cachedAmbativasiData.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * cachedAmbativasiData.length);
    return cachedAmbativasiData[randomIndex];
}

/**
 * Mendapatkan kutipan ambativasi berdasarkan ID.
 */
function getAmbativasiById(id) {
    if (cachedAmbativasiData.length === 0) return null;
    return cachedAmbativasiData.find(data => data.id === id) || null;
}


/**
 * Memuat data dari URL eksternal dan menyimpannya ke cache.
 */
async function loadRemoteData() {
    try {
        // PERBAIKAN CACHING: Tambahkan query parameter unik untuk memaksa GitHub CDN memuat ulang data.
        const uniqueUrl = `${DATASET_URL}?v=${Date.now()}`; 
        console.log(`[AMBATIVASI] Mencoba memuat data dari Host: ${uniqueUrl}`);
        
        const response = await axios.get(uniqueUrl, { timeout: 15000 });
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
        console.log(`[AMBATIVASI] Data berhasil dimuat. Total: ${cachedAmbativasiData.length} kutipan.`);

    } catch (error) {
        isInitialized = false;
        console.error(`[AMBATIVASI] GAGAL memuat data dari GitHub: ${error.message}`);
        // Jika gagal, data cache akan tetap kosong/lama, tetapi server tidak akan crash.
    }
}


// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/random/ambativasi', async (req, res) => {
        const { id } = req.query;

        // Inisialisasi hanya jika belum (atau jika gagal sebelumnya)
        if (!isInitialized) {
            await loadRemoteData();
        }
        
        // Cek jika data masih kosong setelah pemuatan
        if (cachedAmbativasiData.length === 0) {
            return res.status(503).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Layanan Ambativasi Belum Siap. Dataset gagal dimuat dari GitHub. Cek log server untuk detail."
            });
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
            // Ini seharusnya tidak terjadi jika cachedAmbativasiData.length > 0
            return res.status(500).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Internal Server Error: Gagal mendapatkan kutipan ambativasi."
            });
        }
    });
};