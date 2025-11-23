/* File: src/api/search/scroblox.js - Fixed Version */
const axios = require('axios');

class RobloxScriptAPI {
    constructor() {
        this.baseUrl = "https://api.eberardos.my.id";
        this.timeout = 15000;
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        };
    }

    /**
     * Bersihkan title dari teks yang tidak perlu
     */
    cleanTitle(title) {
        if (!title) return "Unknown Script";
        
        let cleaned = title
            .replace(/^WORKINGFREE\s*/i, '')
            .replace(/\bWORKING\b/gi, '')
            .replace(/\bFREE\b/gi, '')
            .replace(/\bSCRIPT\b/gi, '')
            .replace(/\bHUB\b/gi, '')
            .replace(/\bGUI\b/gi, '')
            .replace(/\b(NO KEY|KEYLESS)\b/gi, '')
            .replace(/\b(2024|2025)\b/g, '')
            .replace(/\s+[-–—]+\s+/g, ' - ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^[-\s]+|[-\s]+$/g, '');
        
        return cleaned || "Unknown Script";
    }

    /**
     * Search scripts dari API eksternal
     */
    async searchScripts(query) {
        try {
            const url = `${this.baseUrl}/search/roblox-script`;
            const params = { q: query };
            
            console.log(`[SCROBLOX] Searching: ${query}`);
            
            const response = await axios.get(url, {
                params,
                timeout: this.timeout,
                headers: this.headers,
                validateStatus: (status) => status < 500
            });

            if (response.status !== 200) {
                throw new Error(`API returned status ${response.status}`);
            }

            const data = response.data;
            
            // Validasi response dari API
            if (!data.status || !data.result || !Array.isArray(data.result)) {
                throw new Error("Invalid API response format");
            }

            // Format ulang response agar lebih rapi
            const scripts = data.result.map(item => ({
                title: this.cleanTitle(item.title || item.originalTitle),
                url: item.url,
                downloadUrl: item.downloadUrl,
                loadstring: item.loadstring
            }));

            console.log(`[SCROBLOX] Found ${scripts.length} scripts`);
            return scripts;

        } catch (error) {
            console.error('[SCROBLOX ERROR]', error.message);
            throw error;
        }
    }
}

// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/search/scroblox', async (req, res) => {
        const { query } = req.query;
        const CREATOR_NAME = "Givy";
        
        if (!query || query.trim() === '') {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'query' wajib diisi. Contoh: /search/scroblox?query=fish+it"
            });
        }

        try {
            const scraper = new RobloxScriptAPI();
            const results = await scraper.searchScripts(query.trim());
            
            if (results.length === 0) {
                return res.status(404).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: `Tidak ada script ditemukan untuk query: ${query}`
                });
            }

            res.status(200).json({
                status: true,
                creator: CREATOR_NAME,
                query: query,
                total: results.length,
                result: results
            });

        } catch (error) {
            console.error("[SCROBLOX] Endpoint Error:", error.message);
            
            res.status(500).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Gagal melakukan pencarian script Roblox",
                error: error.message
            });
        }
    });
};