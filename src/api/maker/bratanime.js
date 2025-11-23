const axios = require('axios');

// Handler untuk Brat Anime Maker
module.exports = function(app) {
    const CREATOR_NAME = "Givy";
    const UPSTREAM_URL = "https://api.elrayyxml.web.id/api/maker/bratanime";

    app.get('/maker/bratanime', async (req, res) => {
        const { text } = req.query;

        // 1. Validasi Parameter Wajib
        if (!text) {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'text' harus disediakan"
            });
        }

        const targetUrl = `${UPSTREAM_URL}?text=${encodeURIComponent(text)}`;

        try {
            // 2. Tembak API Pihak Ketiga
            const response = await axios.get(targetUrl, {
                responseType: 'arraybuffer', // Penting: Minta respons sebagai buffer/binary
                timeout: 15000 // Beri waktu lebih lama untuk pembuatan gambar
            });

            // 3. Cek Status Code dan Header
            if (response.status === 200) {
                const contentType = response.headers['content-type'];

                // Verifikasi apakah responsnya adalah gambar
                if (contentType && contentType.startsWith('image/')) {
                    // Berhasil mendapatkan gambar. Teruskan header dan data
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Length', response.data.length);
                    // Langsung kirim buffer gambar
                    return res.send(response.data);
                } else {
                    // Jika status 200 tapi bukan gambar (mungkin error JSON dari upstream)
                    let errorData = response.data.toString('utf8');
                    try {
                        errorData = JSON.parse(errorData);
                    } catch (e) {
                        // Jika bukan JSON, biarkan sebagai teks mentah
                    }

                    return res.status(500).json({
                        status: false,
                        creator: CREATOR_NAME,
                        message: "Upstream API mengembalikan format tidak terduga.",
                        details: errorData
                    });
                }
            } 
            
            // 4. Tangani Status Error dari Upstream
            else {
                return res.status(response.status).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: `Upstream API mengembalikan status error: ${response.status}`,
                    details: response.data ? response.data.toString('utf8') : null
                });
            }

        } catch (error) {
            console.error("Brat Anime Proxy Error:", error.message);

            // Jika error adalah respons dari server (misal 404/500), ambil detailnya
            let details = error.message;
            if (error.response && error.response.data) {
                details = error.response.data.toString('utf8');
                try {
                    details = JSON.parse(details);
                } catch (e) { /* ignore */ }
            }

            return res.status(500).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Internal Server Error atau Upstream Service Down",
                details: details
            });
        }
    });
};