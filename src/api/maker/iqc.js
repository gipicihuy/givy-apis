/* File: src/api/maker/iqc.js */
const axios = require('axios');

module.exports = function(app) {
    const CREATOR_NAME = "Givy";
    const UPSTREAM_URL = "https://brat.siputzx.my.id/iphone-quoted";

    app.get('/maker/iqc', async (req, res) => {
        const { 
            messageText, 
            carrierName, 
            time, 
            batteryPercentage, 
            signalStrength,
            emojiStyle 
        } = req.query;

        // 1. Validasi Parameter Wajib
        if (!messageText) {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'messageText' harus disediakan"
            });
        }

        // 2. Set default values untuk parameter opsional
        const params = new URLSearchParams();
        params.append('messageText', messageText);
        params.append('carrierName', carrierName || 'AXIS');
        
        if (time) params.append('time', time);
        if (batteryPercentage) params.append('batteryPercentage', batteryPercentage);
        if (signalStrength) params.append('signalStrength', signalStrength);
        if (emojiStyle) params.append('emojiStyle', emojiStyle);

        // 3. Construct URL dengan parameter
        const targetUrl = `${UPSTREAM_URL}?${params.toString()}`;

        try {
            // 4. Tembak API Pihak Ketiga
            const response = await axios.get(targetUrl, {
                responseType: 'arraybuffer', // Penting: Minta respons sebagai buffer/binary
                timeout: 15000 // Beri waktu lebih lama untuk pembuatan gambar
            });

            // 5. Cek Status Code dan Header
            if (response.status === 200) {
                const contentType = response.headers['content-type'];

                // Verifikasi apakah responsnya adalah gambar
                if (contentType && contentType.startsWith('image/')) {
                    // Berhasil mendapatkan gambar. Teruskan header dan data
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Length', response.data.length);
                    res.setHeader('Content-Disposition', `inline; filename="iqc-${Date.now()}.png"`);
                    
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
            
            // 6. Tangani Status Error dari Upstream
            else {
                return res.status(response.status).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: `Upstream API mengembalikan status error: ${response.status}`,
                    details: response.data ? response.data.toString('utf8') : null
                });
            }

        } catch (error) {
            console.error("IQC Maker Proxy Error:", error.message);

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
