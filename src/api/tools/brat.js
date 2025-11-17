/* File: src/api/tools/brat.js (Simple External Proxy Version - Single Parameter) */
const axios = require("axios");

// Daftar URL API eksternal yang akan dicoba secara berurutan (fallback)
const API_URLS = [
    "https://brat.caliphdev.com/api/brat?text=",
    "https://aqul-brat.hf.space/?text=",
    "https://siputzx-bart.hf.space/?q=", // Perhatikan beberapa host menggunakan ?q=
    "https://qyuunee-brat.hf.space/?q="
];

class BratProxy {
    async fetchImageWithFallback(text) {
        let lastError = null;
        
        // Loop melalui semua URL yang tersedia
        for (let i = 0; i < API_URLS.length; i++) {
            const baseUrl = API_URLS[i];
            
            // Perlu disesuaikan karena ada host yang menggunakan "?q="
            const queryParam = baseUrl.includes("?q=") ? "q" : "text"; 
            const url = `${baseUrl}${encodeURIComponent(text)}`;

            try {
                const response = await axios.get(url, {
                    timeout: 15000, 
                    responseType: "arraybuffer"
                });
                
                // Jika berhasil, kembalikan buffer dan hentikan loop
                console.log(`Berhasil mengambil gambar dari Host ke-${i + 1}: ${url}`);
                return {
                    buffer: Buffer.from(response.data),
                    hostIndex: i + 1
                };
            } catch (error) {
                const status = error.response ? error.response.status : 'NETWORK_ERROR';
                lastError = { message: error.message, status: status, host: i + 1 };
                console.error(`Host ke-${i + 1} gagal (Status ${status}). Mencoba host berikutnya...`);
                // Lanjut ke iterasi berikutnya (host fallback)
            }
        }
        
        // Jika loop selesai dan tidak ada yang berhasil, lemparkan error terakhir
        if (lastError) {
            throw new Error(`Semua API BRAT gagal dihubungi. Error terakhir dari Host ${lastError.host}: Status ${lastError.status} - ${lastError.message}`);
        }
        throw new Error("Daftar API BRAT kosong atau tidak terjangkau.");
    }
}

// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/tools/brat', async (req, res) => {
        
        if (global.totalreq !== undefined) {
             global.totalreq++;
        }

        const params = req.query; 
        const text = params.text;
        // Parameter 'host' diabaikan
        
        if (!text) {
             if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 400, url: req.originalUrl, duration: 0, error: "Missing 'text' parameter" });
            }
            return res.status(400).json({
                status: false,
                creator: "Givy",
                message: "Parameter 'text' wajib diisi. Contoh: /tools/brat?text=Selamat Datang"
            });
        }
        
        const proxy = new BratProxy();

        try {
            const { buffer: imageBuffer, hostIndex } = await proxy.fetchImageWithFallback(text);
            
            if (imageBuffer && imageBuffer.length > 0) {
                // Mengirimkan buffer gambar PNG
                res.setHeader("Content-Type", "image/png");
                res.setHeader("Content-Disposition", `inline; filename="brat-output-host-${hostIndex}.png"`);

                if (typeof queueLog === 'function') {
                    queueLog({ method: req.method, status: 200, url: req.originalUrl, duration: 0, info: `Sent image/png buffer via successful Host ${hostIndex}` }); 
                }

                return res.status(200).send(imageBuffer);
            } else {
                 throw new Error("API eksternal mengembalikan data kosong.");
            }
            
        } catch (error) {
            const errorMessage = `BRAT API Error: ${error.message}`;
            console.error("Error API:", errorMessage);
            
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 500, url: req.originalUrl, duration: 0, error: errorMessage });
            }
            
            res.status(500).json({
                status: false,
                creator: "Givy",
                message: errorMessage
            });
        }
    });
};
