const axios = require('axios');

module.exports = function(app) {
    app.get('/stalk/ml', async (req, res) => {
        const { userId, zoneId } = req.query;
        const CREATOR_NAME = "Givy";
        
        if (!userId || !zoneId) {
            return res.status(400).json({ status: false, creator: CREATOR_NAME, message: "User ID dan Zone ID harus disediakan" });
        }

        const DELINE_URL = `https://api.deline.web.id/stalker/stalkml?id=${userId}&zone=${zoneId}`;

        try {
            const response = await axios.get(DELINE_URL);
            const data = response.data;
            
            // KODE KRUSIAL: Memeriksa struktur respons sukses dari Deline
            if (data.status === true && data.result && data.result.success === true) {
                
                // MENGEMBALIKAN 200 OK
                return res.status(200).json({
                    status: true,
                    creator: CREATOR_NAME,
                    message: "ML Stalk Success",
                    result: {
                        id: userId,
                        zone: zoneId,
                        nickname: data.result.username, // NICKNAME DIAMBIL DARI SINI
                        region: data.result.region
                    }
                });
            } else {
                // MENGEMBALIKAN 404 NOT FOUND
                const errorMessage = data.message || (data.result && data.result.message) || "Gagal mendapatkan data. ID/Zone tidak valid.";
                
                return res.status(404).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: errorMessage
                });
            }

        } catch (error) {
            console.error("Deline API Proxy Error:", error.message);
            return res.status(500).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Internal Server Error or Upstream Service Down (Deline API)",
                details: error.message
            });
        }
    });
};