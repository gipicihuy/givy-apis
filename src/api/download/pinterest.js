/* File: src/api/download/pinterest.js */
const axios = require("axios");
const {
    wrapper
} = require("axios-cookiejar-support"); // PENTING: Perlu instalasi
const {
    CookieJar
} = require("tough-cookie"); // PENTING: Perlu instalasi
const cheerio = require("cheerio");
const FormData = require("form-data"); // PENTING: Perlu instalasi

class PinterestDownloader {
    constructor() {
        // Console.log dihilangkan untuk menghindari excessive logging di Vercel
        const jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar: jar,
            responseType: "json",
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        }));
        this.baseUrl = "https://pindown.io";
    }

    async download({
        url,
        ...rest
    }) {
        try {
            // 1. Ambil token keamanan dinamis dari halaman utama
            const initialResponse = await this.client.get(this.baseUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                },
                responseType: "text", 
                timeout: 15000,
                ...rest
            });
            const $initial = cheerio.load(initialResponse.data);
            const hiddenInput = $initial('form#get_video input[type="hidden"]');
            const tokenName = hiddenInput.attr("name");
            const tokenValue = hiddenInput.attr("value");
            
            if (!tokenName || !tokenValue) {
                throw new Error("Gagal mengambil token keamanan dari Pindown.io. Struktur website mungkin telah berganti.");
            }

            // 2. Kirim POST request dengan URL dan token
            const form = new FormData();
            form.append("url", url);
            form.append(tokenName, tokenValue);

            const actionResponse = await this.client.post(`${this.baseUrl}/action`, form, {
                headers: {
                    ...form.getHeaders(),
                    Referer: this.baseUrl,
                    Accept: "application/json, text/javascript, */*; q=0.01",
                    Origin: this.baseUrl,
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
                },
                timeout: 15000
            });

            let htmlToParse;
            if (actionResponse.data && actionResponse.data.success && typeof actionResponse.data.html === "string") {
                htmlToParse = actionResponse.data.html;
            } else {
                 throw new Error("Respon dari Pindown.io tidak valid atau gagal diproses.");
            }
            
            if (!htmlToParse) {
                throw new Error("Konten HTML hasil tidak ditemukan.");
            }

            // 3. Ekstrak data dari hasil HTML
            const $result = cheerio.load(htmlToParse);
            const mediaContent = $result(".media-content");
            const title = mediaContent.find("strong")?.text()?.trim() || "No title available";
            const description = mediaContent.find(".video-des")?.text()?.trim() || "No description";
            
            const image = $result(".media-left .image img");
            const thumbnail = image?.attr("src") || "No thumbnail available";
            
            const videoPreview = $result(".modal-content video");
            const previewUrl = videoPreview?.attr("src") || null; 

            const downloads = [];
            $result(".download-link table tbody tr").each((i, elem) => {
                const type = $result(elem).find(".video-quality")?.text()?.trim();
                const link = $result(elem).find("a.button")?.attr("href");
                if (type && link) {
                    downloads.push({
                        quality: type,
                        url: link
                    });
                }
            });

            // Fallback untuk Gambar (jika tidak ada tabel video/downloads)
            if (downloads.length === 0) {
                 const directImageLink = $result('a.button[href*="cdn.pinimg.com"]')?.attr('href');
                 if (directImageLink) {
                     downloads.push({
                         quality: "Original Image",
                         url: directImageLink
                     });
                 }
            }


            if (downloads.length === 0) {
                 throw new Error("Gagal mendapatkan tautan unduhan. Pin mungkin Carousel/Idea Pin yang tidak didukung, atau situs web memblokir IP Vercel.");
            }

            return {
                title: title,
                description: description,
                thumbnail: thumbnail,
                preview_url: previewUrl, 
                media_count: downloads.length,
                downloads: downloads,
                ...rest
            };
            
        } catch (error) {
            let errorMessage = `Scraping gagal: ${error.message}`;
            if (error.response && error.response.status === 403) {
                errorMessage = "Gagal mengambil data. Pindown.io mungkin memblokir IP Vercel. Coba lagi atau gunakan IP lain.";
            }

            return {
                error: "Failed to download media.",
                message: errorMessage,
                details: error.response?.data || null
            };
        }
    }
}


// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/download/pinterest', async (req, res) => {
        
        if (global.totalreq !== undefined) {
             global.totalreq++;
        }
        
        const { url } = req.query; 
        
        if (!url) {
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 400, url: req.originalUrl, duration: 0, error: "Missing 'url' parameter" });
            }
            return res.status(400).json({
                status: false,
                message: "Parameter 'url' wajib diisi. Contoh: /download/pinterest?url=https://pin.it/xxxxx"
            });
        }
        
        try {
            const api = new PinterestDownloader();
            const response = await api.download({ url });
            
            if (response.error) {
                if (typeof queueLog === 'function') {
                    queueLog({ method: req.method, status: 500, url: req.originalUrl, duration: 0, error: response.message });
                }
                return res.status(500).json({
                    status: false,
                    creator: 'Givy',
                    message: response.message,
                    details: response.details || null
                });
            }
            
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 200, url: req.originalUrl, duration: 0 }); 
            }
            
            res.status(200).json({
                status: true,
                creator: 'Givy',
                result: response
            });
            
        } catch (error) {
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 500, url: req.originalUrl, duration: 0, error: error.message });
            }
            
            res.status(500).json({
                status: false,
                message: error.message || 'Terjadi kesalahan internal pada server saat mendownload Pinterest.'
            });
        }
    });
};
