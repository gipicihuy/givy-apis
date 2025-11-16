/* File: src/api/download/spotify.js */
const axios = require('axios');
const cheerio = require('cheerio');

// Fungsi inti untuk scraping Spotify
async function spotifydl(url) {
    try {
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

        // 1. Ambil token dan cookie dari halaman utama Spotmate
        const rynn = await axios.get('https://spotmate.online/', {
            headers: {
                'user-agent': userAgent
            }
        });
        const $ = cheerio.load(rynn.data);
        
        // 2. Buat instance Axios dengan header, token CSRF, dan cookie yang sudah didapat
        const api = axios.create({
            baseURL: 'https://spotmate.online',
            headers: {
                // Pastikan cookie diformat dengan benar
                cookie: (rynn.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; '),
                'content-type': 'application/json',
                'user-agent': userAgent,
                'x-csrf-token': $('meta[name="csrf-token"]').attr('content'),
                'Referer': 'https://spotmate.online/'
            }
        });
        
        // 3. Panggil kedua endpoint secara paralel (metadata dan download link)
        const [metaResponse, dlResponse] = await Promise.all([
            api.post('/getTrackData', { spotify_url: url }),
            api.post('/convert', { urls: url })
        ]);
        
        const meta = metaResponse.data;
        const dl = dlResponse.data;

        if (!meta.id) {
             throw new Error("Gagal mengambil metadata. Mungkin URL tidak valid atau server Spotmate sedang sibuk.");
        }

        if (!dl.url) {
             throw new Error("Gagal mendapatkan link download. Server Spotmate tidak mengembalikan URL.");
        }
        
        // 4. Return data yang terstruktur
        return {
            title: meta.name,
            id: meta.id,
            images: meta.album.images[0].url,
            duration_ms: meta.duration_ms, 
            artist: meta.artists[0].name,
            download_url: dl.url
        };
    } catch (error) {
        console.error('Error in spotifydl:', error.message);
        throw new Error(error.message || 'Terjadi kesalahan saat memproses permintaan Spotify.');
    }
}


// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/download/spotify', async (req, res) => {
        // Increment request counter
        if (global.totalreq !== undefined) {
             global.totalreq++;
        }
       
        const { url } = req.query;
        
        if (!url || !url.includes('spotify.com/track/')) {
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 400, url: req.originalUrl, duration: 0, error: "Missing/Invalid 'url' parameter" });
            }
            return res.status(400).json({
                status: false,
                message: "Parameter 'url' wajib diisi dan harus berupa URL Track Spotify yang valid."
            });
        }
        
        try {
            const result = await spotifydl(url);
            
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 200, url: req.originalUrl, duration: 0 }); 
            }
            
            // Sukses - kembalikan objek JSON
            res.json({
                status: true,
                creator: 'Givy',
                result: result
            });
        } catch (error) {
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 500, url: req.originalUrl, duration: 0, error: error.message });
            }
            
            // Tangani error yang tidak terduga
            res.status(500).json({
                status: false,
                message: error.message || 'Terjadi kesalahan internal pada server saat mengambil data Spotify.'
            });
        }
    });
};
