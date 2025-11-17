/* File: src/api/tools/brat.js */
const axios = require("axios");

// --- ASUMSI IMPORT: PASTIKAN FILE INI ADA ---
// Hapus baris 'const apiConfig = require("../../configs/apiConfig");'
const Html = require("../../data/html/brat/list"); 
// ---------------------------------------------

// Tentukan domain TARGET API EKSTERNAL yang Anda maksud
// Ganti nilai ini jika base API orang tersebut bukan 'wudysoft.xyz'
const EXTERNAL_BASE_DOMAIN = "api.givy.my.id"; 

class HtmlToImg {
    constructor() {
        // URL kini di-*hardcode* ke domain target API eksternal
        this.url = `https://${EXTERNAL_BASE_DOMAIN}/api/tools/html2img`; 
        this.headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36"
        };
    }

    async getImageBuffer(url, responseType = "arraybuffer") {
        try {
            const response = await axios.get(url, {
                responseType: responseType
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching buffer (${responseType}): ${error.message}`);
            throw error;
        }
    }

    async generate({
        text = "Jane Doe",
        output = "png",
        model: template = 1,
        type = "v5"
    }) {
        const data = {
            ext: output,
            html: Html({ 
                text: text,
                output: output,
                template: template
            })
        };

        const fullUrl = `${this.url}/${type}`; 
        
        try {
            const response = await axios.post(fullUrl, data, {
                headers: this.headers,
                timeout: 30000 
            });

            if (response.data && response.data.url) {
                return response.data.url;
            } else {
                throw new Error("Layanan HTML2IMG eksternal tidak mengembalikan URL media yang valid.");
            }
        } catch (error) {
            console.error("Error during API call to external service:", error.message);
            throw error; 
        }
    }
}

// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    // Endpoint: /tools/brat
    app.get('/tools/brat', async (req, res) => {
        
        if (global.totalreq !== undefined) {
             global.totalreq++;
        }
        
        const params = req.query; 
        const outputFormat = params.output ? params.output.toLowerCase() : "png";
        
        if (!params.text) {
             if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 400, url: req.originalUrl, duration: 0, error: "Missing 'text' parameter" });
            }
            return res.status(400).json({
                status: false,
                message: "Parameter 'text' wajib diisi. Contoh: /tools/brat?text=Selamat Datang&output=png"
            });
        }
        
        const htmlToImg = new HtmlToImg();

        try {
            const imageUrl = await htmlToImg.generate({
                ...params,
                output: outputFormat
            });

            if (imageUrl) {
                let buffer;
                let contentType;
                let filenameExtension;

                // Tentukan Content-Type dan ekstensi berdasarkan format output
                if (outputFormat === "gif") {
                    buffer = await htmlToImg.getImageBuffer(imageUrl, "arraybuffer");
                    contentType = "video/mp4"; 
                    filenameExtension = "mp4";
                } else if (outputFormat === "png") {
                    buffer = await htmlToImg.getImageBuffer(imageUrl, "arraybuffer");
                    contentType = "image/png";
                    filenameExtension = "png";
                } else {
                    if (typeof queueLog === 'function') {
                        queueLog({ method: req.method, status: 400, url: req.originalUrl, duration: 0, error: `Output format "${outputFormat}" tidak didukung.` });
                    }
                    return res.status(400).json({
                        status: false,
                        message: `Output format "${outputFormat}" tidak didukung. Hanya mendukung 'png' dan 'gif'.`
                    });
                }

                // Header untuk mengirim data biner
                res.setHeader("Content-Type", contentType);
                res.setHeader("Content-Disposition", `inline; filename="brat-output.${filenameExtension}"`);
                
                if (typeof queueLog === 'function') {
                    queueLog({ method: req.method, status: 200, url: req.originalUrl, duration: 0, info: `Sent ${contentType} buffer` }); 
                }

                // Mengirim Buffer
                return res.status(200).send(Buffer.from(buffer)); 
                
            } else {
                 if (typeof queueLog === 'function') {
                    queueLog({ method: req.method, status: 400, url: req.originalUrl, duration: 0, error: "No image/video URL returned" });
                }
                res.status(400).json({
                    status: false,
                    message: "No image/video URL returned from the service."
                });
            }
        } catch (error) {
            const errorMessage = `BRAT API Error: ${error.message}`;
            console.error("Error API:", errorMessage);
            
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 500, url: req.originalUrl, duration: 0, error: errorMessage });
            }
            
            res.status(500).json({
                status: false,
                message: errorMessage
            });
        }
    });
};
