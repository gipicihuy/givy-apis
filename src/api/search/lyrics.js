/* File: src/api/search/lyrics.js */
const axios = require('axios');

// Handler untuk What Music - Search Lyrics
module.exports = function(app) {
    const CREATOR_NAME = "Givy";
    const UPSTREAM_URL = "https://chocomilk.amira.us.kg/v1/search/lyrics";

    app.get('/search/lyrics', async (req, res) => {
        const { query } = req.query;

        // 1. Validasi Parameter Wajib
        if (!query || query.trim() === '') {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'query' harus disediakan dan tidak boleh kosong. Contoh: /search/lyrics?query=do you ever feel"
            });
        }

        // 2. Encode query untuk URL
        const targetUrl = `${UPSTREAM_URL}?query=${encodeURIComponent(query.trim())}`;

        try {
            // 3. Tembak API Pihak Ketiga
            const response = await axios.get(targetUrl, {
                timeout: 15000, // Timeout 15 detik
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // 4. Cek Status Code dan Response
            if (response.status === 200 && response.data) {
                const apiData = response.data;

                // 5. Validasi struktur response dari API upstream
                if (apiData.success && apiData.data) {
                    // Format response sesuai standar API Givy
                    return res.status(200).json({
                        status: true,
                        creator: CREATOR_NAME,
                        result: {
                            title: apiData.data.title || "Unknown",
                            artist: apiData.data.artist || "Unknown",
                            album: apiData.data.album || "Unknown",
                            duration: apiData.data.duration || 0,
                            duration_formatted: apiData.data.duration ? `${Math.floor(apiData.data.duration / 60)}:${(apiData.data.duration % 60).toString().padStart(2, '0')}` : "0:00",
                            lyrics: apiData.data.lyrics || [],
                            total_lines: apiData.data.lyrics ? apiData.data.lyrics.length : 0
                        }
                    });
                } else {
                    // API upstream return success: false atau tidak ada data
                    return res.status(404).json({
                        status: false,
                        creator: CREATOR_NAME,
                        message: apiData.error || "Lirik tidak ditemukan untuk query yang diberikan.",
                        query: query
                    });
                }
            } else {
                // Status bukan 200
                return res.status(response.status).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: `Upstream API mengembalikan status error: ${response.status}`,
                    details: response.data || null
                });
            }

        } catch (error) {
            console.error("Lyrics Search Proxy Error:", error.message);

            // Tangani berbagai jenis error
            let status = 500;
            let message = "Internal Server Error atau Upstream Service Down";
            let details = error.message;

            if (error.response) {
                // Error dari server upstream (misal 404, 500, dll)
                status = error.response.status;
                message = error.response.data?.error || `HTTP Error ${status} dari Upstream API`;
                details = error.response.data || error.message;
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                // Timeout
                message = "Request timeout. Upstream API tidak merespons dalam waktu yang ditentukan.";
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                // Network error
                message = "Tidak dapat terhubung ke Upstream API. Periksa koneksi internet atau API sedang down.";
            }

            return res.status(status).json({
                status: false,
                creator: CREATOR_NAME,
                message: message,
                details: details,
                query: query
            });
        }
    });
};