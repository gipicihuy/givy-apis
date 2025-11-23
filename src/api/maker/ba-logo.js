const axios = require('axios');

// Handler untuk Blue Archive Logo Maker
module.exports = function(app) {
    const CREATOR_NAME = "Givy";
    const UPSTREAM_URL = "https://api.nekolabs.web.id/canvas/ba-logo";

    app.get('/maker/ba-logo', async (req, res) => {
        // Ambil dua parameter teks
        const { textL, textR } = req.query;

        // 1. Validasi Parameter Wajib
        if (!textL || !textR) {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'textL' dan 'textR' harus disediakan"
            });
        }

        // Susun URL untuk API Upstream
        const targetUrl = `${UPSTREAM_URL}?textL=${encodeURIComponent(textL)}&textR=${encodeURIComponent(textR)}`;

        try {
            // 2. Tembak API Pihak Ketiga
            const response = await axios.get(targetUrl, {
                responseType: 'arraybuffer', // Respons adalah binary/gambar
                timeout: 15000 
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
                    // Jika status 200 tapi bukan gambar (mungkin error JSON/text dari upstream)
                    let errorData = response.data.toString('utf8');
                    try {
                        errorData = JSON.parse(errorData);
                    } catch (e) { /* ignore */ }

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
            console.error("Blue Archive Logo Proxy Error:", error.message);

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