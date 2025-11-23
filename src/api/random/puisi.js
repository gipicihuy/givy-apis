const axios = require('axios'); // Digunakan untuk fetching data dari Host/GitHub
const CREATOR_NAME = "Givy";

// URL DATASET PUISI DARI GITHUB
const DATASET_URL = 'https://raw.githubusercontent.com/gipicihuy/givy/refs/heads/main/puisi_dataset.json'; 

// Cache untuk menyimpan data
let cachedPuisiData = [];
let isInitialized = false;

// Fungsi Pembersihan Teks (Sesuai Versi Final)
function cleanPoemText(text) {
    if (!text) return "";
    let cleaned = text;
    
    // 1. Membersihkan karakter non-standar
    cleaned = cleaned.replace(/[\uFEFF\u00A0]/g, ' ').trim(); 
    
    // 2. Ganti newline dengan spasi + newline + spasi (untuk memisahkan kata yang menempel)
    cleaned = cleaned.replace(/\n/g, ' \n '); 
    cleaned = cleaned.replace(/ {2,}/g, ' '); // Hapus spasi ganda
    
    // 3. Lanjutkan dengan pembersihan struktur \n
    cleaned = cleaned.replace(/ \n /g, '\n').trim(); 
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); 
    
    // 4. Standarisasi Tanda Baca
    cleaned = cleaned.replace(/\.{3,}/g, '...');
    cleaned = cleaned.replace(/!{3,}/g, '!!'); 
    cleaned = cleaned.replace(/\?{3,}/g, '??'); 
    cleaned = cleaned.replace(/,{3,}/g, ','); 
    
    return cleaned;
}

// Fungsi Load Data dari Host (Caching)
async function loadRemoteData() {
    try {
        console.log(`[PUISI] Mencoba memuat data dari Host: ${DATASET_URL}`);
        
        const response = await axios.get(DATASET_URL, { timeout: 15000 });
        const rawLines = response.data.split('\n').filter(line => line.trim().length > 0);

        // Parse semua JSON Lines
        cachedPuisiData = rawLines.map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return null; 
            }
        }).filter(item => item !== null);
        
        isInitialized = true;
        
        if (cachedPuisiData.length === 0) {
             throw new Error("Data berhasil diakses, tetapi tidak ada puisi yang valid ditemukan.");
        }
        
        console.log(`[PUISI] Total ${cachedPuisiData.length} puisi dimuat ke memori dari Host.`);
        return true;

    } catch (error) {
        console.error(`[PUISI ERROR] Gagal memuat dataset dari Host: ${error.message}`);
        isInitialized = true;
        cachedPuisiData = [];
        return false;
    }
}

// Panggil saat modul dimuat (Cold Start)
loadRemoteData();


async function getRandomPuisi() {
    if (cachedPuisiData.length === 0) {
        return { code: 503, message: "Dataset Puisi belum tersedia atau gagal dimuat dari Host." };
    }
    
    const randomIndex = Math.floor(Math.random() * cachedPuisiData.length); 
    const rawData = cachedPuisiData[randomIndex];

    // Bersihkan teks sebelum di kirim
    const cleanedPuisi = cleanPoemText(rawData.puisi);
    
    const resultData = {
        puisi: cleanedPuisi,
        author: rawData.author
    };
    
    return { code: 200, data: resultData };
}

// Handler Express
module.exports = function(app) {
    
    app.get('/random/puisi', async (req, res) => {
        
        if (!isInitialized || cachedPuisiData.length === 0) {
            // Coba muat ulang jika ada kegagalan saat cold start
            if (!isInitialized) {
                 await loadRemoteData(); 
            }
             
            if (cachedPuisiData.length === 0) {
                return res.status(503).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: "Layanan Puisi Belum Siap. Dataset gagal dimuat dari Host."
                });
            }
        }
        
        const result = await getRandomPuisi();
        
        if (result.code === 200) {
            
            return res.status(200).json({
                status: true,
                creator: CREATOR_NAME,
                puisi: result.data.puisi, 
                author: result.data.author
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