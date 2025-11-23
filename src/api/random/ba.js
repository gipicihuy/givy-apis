const axios = require('axios');
const CREATOR_NAME = "Givy";
const IMAGE_LIST_URL = 'https://raw.githubusercontent.com/rynxzyy/blue-archive-r-img/refs/heads/main/links.json';

class BlueArchive {
    /**
     * Mengambil URL list gambar, memilih secara acak, dan mengambil buffer gambar tersebut.
     * @returns {Promise<{buffer: Buffer, contentType: string}>} Objek yang berisi buffer gambar dan tipe konten.
     */
    async fetchRandomImage() {
        // 1. Ambil list URL gambar (fetchJson manual)
        let imageListResponse;
        try {
            imageListResponse = await axios.get(IMAGE_LIST_URL, { timeout: 10000 });
        } catch (error) {
            throw new Error(`Gagal mengambil daftar URL dari GitHub: ${error.message}`);
        }

        const data = imageListResponse.data;

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Daftar gambar kosong atau tidak valid dari sumber.");
        }
        
        // 2. Pilih URL secara acak
        const randomUrl = data[Math.floor(data.length * Math.random())];
        
        // 3. Ambil buffer gambar (getBuffer manual)
        let imageResponse;
        try {
            imageResponse = await axios.get(randomUrl, { 
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    // Header standar untuk menghindari blokir dari CDN/Host gambar
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/jpeg,image/png,image/*,*/*'
                }
            });
        } catch (error) {
            throw new Error(`Gagal mengambil buffer gambar dari ${randomUrl}: ${error.message}`);
        }

        const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
        const buffer = Buffer.from(imageResponse.data);
        
        // Validasi buffer (seperti di contoh BRAT)
        if (buffer.length < 100) {
            throw new Error(`Buffer gambar terlalu kecil (${buffer.length} bytes). URL: ${randomUrl}`);
        }

        return {
            buffer: buffer,
            contentType: contentType
        };
    }
}

// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/random/ba', async (req, res) => {
        const startTime = Date.now();
        const proxy = new BlueArchive();

        try {
            console.log(`🔄 Memproses request /random/ba`);
            
            // Fetch image
            const { buffer: imageBuffer, contentType } = await proxy.fetchRandomImage();
            
            const duration = Date.now() - startTime;
            
            console.log(`✅ Mengirim image (${imageBuffer.length} bytes) dengan Content-Type: ${contentType}`);
            
            // Set headers untuk image response
            res.setHeader("Content-Type", contentType);
            res.setHeader("Content-Length", imageBuffer.length);
            res.setHeader("Content-Disposition", `inline; filename="bluearchive-${Date.now()}.${contentType.split('/')[1] || 'png'}"`);
            res.setHeader("Cache-Control", "public, max-age=3600"); // Cache selama 1 jam
            res.setHeader("X-Creator", CREATOR_NAME);
            
            // Kirim buffer sebagai response
            return res.status(200).end(imageBuffer, 'binary');
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error.message || 'Terjadi kesalahan tidak terduga saat memuat gambar BA.';
            
            console.error(`❌ BA API Error:`, errorMessage);
            
            // Response error dalam format JSON
            return res.status(500).json({
                status: false,
                creator: CREATOR_NAME,
                message: `Gagal memuat gambar Blue Archive: ${errorMessage}`,
                duration: duration
            });
        }
    });
};