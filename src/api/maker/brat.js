/* File: src/api/tools/brat.js (Fixed Version) */
const axios = require("axios");

// Daftar URL API eksternal dengan format yang benar
const API_CONFIGS = [
    { url: "https://brat.siputzx.my.id/image", param: "text" },
    { url: "https://aqul-brat.hf.space/", param: "text" },
    { url: "https://siputzx-bart.hf.space/", param: "q" },
    { url: "https://qyuunee-brat.hf.space/", param: "q" }
];

class BratProxy {
    async fetchImageWithFallback(text) {
        let lastError = null;
        
        // Loop melalui semua konfigurasi API yang tersedia
        for (let i = 0; i < API_CONFIGS.length; i++) {
            const config = API_CONFIGS[i];
            const fullUrl = `${config.url}?${config.param}=${encodeURIComponent(text)}`;

            try {
                console.log(`Mencoba Host ke-${i + 1}: ${fullUrl}`);
                
                const response = await axios.get(fullUrl, {
                    timeout: 15000,
                    responseType: "arraybuffer",
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/png,image/*,*/*'
                    },
                    validateStatus: (status) => status === 200
                });
                
                // Validasi bahwa response adalah gambar
                const contentType = response.headers['content-type'];
                if (!contentType || !contentType.includes('image')) {
                    throw new Error(`Response bukan image (Content-Type: ${contentType})`);
                }

                const buffer = Buffer.from(response.data);
                
                // Validasi ukuran buffer
                if (buffer.length < 100) {
                    throw new Error(`Buffer terlalu kecil (${buffer.length} bytes)`);
                }
                
                console.log(`✅ Berhasil dari Host ke-${i + 1}. Size: ${buffer.length} bytes`);
                return {
                    buffer: buffer,
                    hostIndex: i + 1,
                    apiName: config.url
                };
                
            } catch (error) {
                const status = error.response?.status || 'NETWORK_ERROR';
                const message = error.message;
                
                lastError = { 
                    message: message, 
                    status: status, 
                    host: i + 1,
                    url: fullUrl
                };
                
                console.error(`❌ Host ke-${i + 1} gagal: ${status} - ${message}`);
                
                // Lanjut ke host berikutnya
                continue;
            }
        }
        
        // Jika semua host gagal
        if (lastError) {
            throw new Error(
                `Semua ${API_CONFIGS.length} API BRAT gagal. ` +
                `Error terakhir dari Host ${lastError.host}: ` +
                `Status ${lastError.status} - ${lastError.message}`
            );
        }
        
        throw new Error("Tidak ada API BRAT yang tersedia.");
    }
}

// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/maker/brat', async (req, res) => {
        const startTime = Date.now();
        
        // Increment total request
        if (global.totalreq !== undefined) {
            global.totalreq++;
        }

        const { text } = req.query;
        
        // Validasi parameter text
        if (!text || text.trim() === '') {
            const duration = Date.now() - startTime;
            
            if (typeof queueLog === 'function') {
                queueLog({ 
                    method: req.method, 
                    status: 400, 
                    url: req.originalUrl, 
                    duration: duration, 
                    error: "Missing 'text' parameter" 
                });
            }
            
            return res.status(400).json({
                status: false,
                creator: "Givy",
                message: "Parameter 'text' wajib diisi dan tidak boleh kosong. Contoh: /tools/brat?text=Hello World"
            });
        }
        
        const proxy = new BratProxy();

        try {
            console.log(`🔄 Memproses request Brat untuk text: "${text}"`);
            
            // Fetch image dengan fallback mechanism
            const { buffer: imageBuffer, hostIndex, apiName } = await proxy.fetchImageWithFallback(text);
            
            const duration = Date.now() - startTime;
            
            if (!imageBuffer || imageBuffer.length === 0) {
                throw new Error("API mengembalikan buffer kosong");
            }
            
            console.log(`✅ Mengirim image (${imageBuffer.length} bytes) dari Host ${hostIndex}`);
            
            // Log sukses
            if (typeof queueLog === 'function') {
                queueLog({ 
                    method: req.method, 
                    status: 200, 
                    url: req.originalUrl, 
                    duration: duration
                });
            }
            
            // Set headers untuk image response
            res.setHeader("Content-Type", "image/png");
            res.setHeader("Content-Length", imageBuffer.length);
            res.setHeader("Content-Disposition", `inline; filename="brat-${Date.now()}.png"`);
            res.setHeader("Cache-Control", "public, max-age=3600");
            res.setHeader("X-Brat-Host", `Host-${hostIndex}`);
            res.setHeader("X-Brat-API", apiName);
            
            // Kirim buffer sebagai response
            return res.status(200).end(imageBuffer, 'binary');
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error.message || 'Terjadi kesalahan tidak terduga';
            
            console.error(`❌ BRAT API Error:`, errorMessage);
            
            // Log error
            if (typeof queueLog === 'function') {
                queueLog({ 
                    method: req.method, 
                    status: 500, 
                    url: req.originalUrl, 
                    duration: duration, 
                    error: errorMessage 
                });
            }
            
            // Response error dalam format JSON
            return res.status(500).json({
                status: false,
                creator: "Givy",
                message: `Gagal menghasilkan BRAT image: ${errorMessage}`,
                hint: "Coba lagi dalam beberapa saat atau gunakan text yang lebih pendek"
            });
        }
    });
};