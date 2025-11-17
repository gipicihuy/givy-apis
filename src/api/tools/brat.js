/* File: src/api/tools/brat.js (Simple External Proxy Version - TANPA KOYEB) */
const axios = require("axios");

// Variabel domain Koyeb tidak lagi diperlukan

class BratService {
    constructor(host = 1) {
        // Daftar URL API eksternal yang dipertahankan
        this.BASE_URLS = {
            1: "https://brat.caliphdev.com/api/brat?text=",
            // Host 2 dan 5 yang sebelumnya menggunakan Koyeb telah dihapus
            2: "https://aqul-brat.hf.space/?text=",
            3: "https://siputzx-bart.hf.space/?q=",
            4: "https://qyuunee-brat.hf.space/?q="
        };
        this.totalHosts = Object.keys(this.BASE_URLS).length; // Sekarang totalnya adalah 4
        
        // Memastikan host berada dalam rentang yang valid (1-4)
        const validHost = Math.min(Math.max(host, 1), this.totalHosts);
        this.BASE_URL = this.BASE_URLS[validHost];
    }

    async fetchImage(text) {
        const url = `${this.BASE_URL}${encodeURIComponent(text)}`;
        try {
            const response = await axios.get(url, {
                timeout: 15000, 
                responseType: "arraybuffer"
            });
            return Buffer.from(response.data);
        } catch (error) {
            const status = error.response ? error.response.status : 'NETWORK_ERROR';
            console.error(`Error fetching image from host ${this.BASE_URL}: Status ${status} - ${error.message}`);
            throw new Error(`Error fetching image from host ${this.BASE_URL} (Status ${status})`);
        }
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
        const host = params.host;

        if (!text) {
             if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 400, url: req.originalUrl, duration: 0, error: "Missing 'text' parameter" });
            }
            return res.status(400).json({
                status: false,
                creator: "Givy",
                message: "Parameter 'text' wajib diisi. Contoh: /tools/brat?text=Selamat Datang&host=1"
            });
        }
        
        const hostInt = host ? parseInt(host) : 1;
        const downloader = new BratService(hostInt);

        // Pesan error diperbarui: Host sekarang hanya 1 sampai 4
        if (hostInt < 1 || hostInt > downloader.totalHosts) {
            return res.status(400).json({
                status: false,
                creator: "Givy",
                message: `Host harus antara 1 dan ${downloader.totalHosts} (saat ini 4). Default: 1.`
            });
        }

        try {
            const imageBuffer = await downloader.fetchImage(text);
            
            if (imageBuffer && imageBuffer.length > 0) {
                res.setHeader("Content-Type", "image/png");
                res.setHeader("Content-Disposition", `inline; filename="brat-proxy-host-${hostInt}.png"`);

                if (typeof queueLog === 'function') {
                    queueLog({ method: req.method, status: 200, url: req.originalUrl, duration: 0, info: `Sent image/png buffer from host ${hostInt}` }); 
                }

                return res.status(200).send(imageBuffer);
            } else {
                 throw new Error("API eksternal mengembalikan data kosong.");
            }
            
        } catch (error) {
            const errorMessage = `BRAT Proxy Error: ${error.message}`;
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
