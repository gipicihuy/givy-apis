const axios = require('axios');
const CREATOR_NAME = "Givy";

// URL DATASET PANTUN DARI GITHUB
const DATASET_URL = 'https://raw.githubusercontent.com/gipicihuy/givy/refs/heads/main/pantun_dataset.json'; 

let cachedPantunData = [];
let isInitialized = false;


/**
 * Memuat data dari URL eksternal dan menyimpannya ke cache.
 */
async function loadRemoteData() {
    try {
        console.log(`[PANTUN] Mencoba memuat data dari Host: ${DATASET_URL}`);
        
        const response = await axios.get(DATASET_URL, { timeout: 15000 });
        const rawLines = response.data.split('\n').filter(line => line.trim().length > 0);

        cachedPantunData = rawLines.map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return null; 
            }
        }).filter(item => item !== null);
        
        isInitialized = true;
        
        if (cachedPantunData.length === 0) {
             throw new Error("Data berhasil diakses, tetapi tidak ada pantun yang valid ditemukan.");
        }
        
        console.log(`[PANTUN] Total ${cachedPantunData.length} pantun dimuat ke memori dari Host.`);
        return true;

    } catch (error) {
        console.error(`[PANTUN ERROR] Gagal memuat dataset dari Host: ${error.message}`);
        isInitialized = true;
        cachedPantunData = [];
        return false;
    }
}

// Panggil saat modul dimuat (Cold Start)
loadRemoteData();


async function getRandomPantun() {
    if (cachedPantunData.length === 0) {
        return { code: 503, message: "Dataset Pantun belum tersedia atau gagal dimuat dari Host." };
    }
    
    const randomIndex = Math.floor(Math.random() * cachedPantunData.length); 
    const rawData = cachedPantunData[randomIndex];

    const resultData = {
        // Gabungkan baris-baris pantun menjadi satu string dengan \n
        sampiran: [rawData.sampiran1, rawData.sampiran2].join('\n'), 
        isi: [rawData.isi1, rawData.isi2].join('\n')
    };
    
    return { code: 200, data: resultData };
}

// Handler Express
module.exports = function(app) {
    
    app.get('/random/pantun', async (req, res) => {
        
        if (!isInitialized || cachedPantunData.length === 0) {
            // Coba muat ulang jika ada kegagalan saat cold start
            if (!isInitialized) {
                 await loadRemoteData(); 
            }
             
            if (cachedPantunData.length === 0) {
                return res.status(503).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: "Layanan Pantun Belum Siap. Dataset gagal dimuat dari Host."
                });
            }
        }
        
        const result = await getRandomPantun();
        
        if (result.code === 200) {
            
            return res.status(200).json({
                status: true,
                creator: CREATOR_NAME,
                // Gabungkan sampiran dan isi untuk field 'pantun' lengkap
                pantun: result.data.sampiran + '\n' + result.data.isi, 
                sampiran: result.data.sampiran, 
                isi: result.data.isi
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