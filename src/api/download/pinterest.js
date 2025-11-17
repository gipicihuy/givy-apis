/* File: src/api/download/pinterest.js */
const axios = require('axios');

// Fungsi IP Spoofing (dipertahankan dari kode Anda)
const cukurukuk = () => {
    return Array.from({length: 4}, () => Math.floor(Math.random() * 256)).join('.');
};

// Fungsi cek URL valid
const ngecek = (url) => {
    return url && url.includes('pinterest.com/pin/');
};

// Fungsi scraping utama
const ngambil = async (url) => {
    const results = {
        status: "",
        site: "",
        title: "",
        description: "",
        image: "" // Ini akan menampung URL download akhir (gambar/video)
    };

    try {
        if (!ngecek(url)) {
            throw new Error("URL tidak valid. Harus berupa tautan pin Pinterest.");
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Forwarded-For': cukurukuk(), // Spoofing IP
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        const response = await axios.get(url, { headers });
        
        if (response.status !== 200) {
            throw new Error(`Gagal mengambil data: HTTP Error ${response.status}`);
        }

        const html = response.data;
        
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let match;

        while ((match = scriptRegex.exec(html)) !== null) {
            const scriptContent = match[1];
            
            // 1. Mengambil Title
            if (scriptContent.includes('gridTitle') && !results.title) {
                const titleMatch = scriptContent.match(/"gridTitle":"([^"]+)"/);
                if (titleMatch) results.title = titleMatch[1];
            }
            
            // 2. Mengambil Description
            if (scriptContent.includes('seoTitle') && !results.description) {
                const descMatch = scriptContent.match(/"seoTitle":"([^"]+)"/);
                if (descMatch) results.description = descMatch[1];
            }
            
            // 3. Mengambil URL Gambar (Original spec/size)
            if (scriptContent.includes('imageSpec_orig') && !results.image) {
                const imageMatch = scriptContent.match(/"imageSpec_orig":{.*?"url":"([^"]+)"/);
                if (imageMatch) results.image = imageMatch[1].replace(/\\/g, '');
            }
            
            // 4. Tambahan: Mengambil URL Video (jika pin adalah video)
            if (scriptContent.includes('video_list') && !results.image) {
                // Mencari URL video kualitas terbaik (biasanya hls atau hd)
                const videoMatch = scriptContent.match(/"video_list":{.*?"videoSpec_hls":{.*?"url":"([^"]+)"/);
                if (videoMatch) {
                    results.image = videoMatch[1].replace(/\\/g, '');
                } else {
                    const videoMatchAlt = scriptContent.match(/"video_list":{.*?"videoSpec_hd":{.*?"url":"([^"]+)"/);
                    if (videoMatchAlt) {
                        results.image = videoMatchAlt[1].replace(/\\/g, '');
                    }
                }
            }
        }
        
        if (!results.image) {
             throw new Error("Gagal mengekstrak URL gambar/video dari pin. Pin mungkin dihapus atau link tidak didukung.");
        }

        results.status = "200 OK";
        
        // Format hasil untuk API
        return {
            status: results.status,
            site: results.site,
            title: results.title || "No Title Found",
            description: results.description || "No Description Found",
            url_download: results.image, // Mengganti 'Image' menjadi 'url_download'
            media_type: results.image.includes('.mp4') ? "video/mp4" : "image/jpeg"
        };

    } catch (error) {
        return {
            error: error.message || 'Terjadi kesalahan tidak terduga.',
            status: "500 ERROR"
        };
    }
};

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
                message: "Parameter 'url' wajib diisi. Contoh: /api/download/pinterest?url=https://pin.it/xxxxx"
            });
        }
        
        try {
            const result = await ngambil(url);
            
            if (result.error) {
                if (typeof queueLog === 'function') {
                    queueLog({ method: req.method, status: 500, url: req.originalUrl, duration: 0, error: result.error });
                }
                return res.status(500).json({
                    status: false,
                    creator: 'Givy',
                    message: result.error
                });
            }
            
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 200, url: req.originalUrl, duration: 0 }); 
            }
            
            res.status(200).json({
                status: true,
                creator: 'Givy',
                result: result
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
