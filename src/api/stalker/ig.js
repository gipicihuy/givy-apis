const axios = require('axios');
const fakeUserAgent = require('fake-useragent');

// Fungsi untuk membuat IP acak
function generateRandomIP() {
    return `1.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// Fungsi untuk membuat User-Agent acak
function generateRandomUserAgent() {
    try {
        const ua = new fakeUserAgent();
        return ua.random;
    } catch (error) {
        // Fallback Agents
        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        ];
        return agents[Math.floor(Math.random() * agents.length)];
    }
}

// Fungsi untuk membersihkan username
function cleanUsername(username) {
    return username.replace(/^@/, '');
}

// Handler Express
module.exports = function(app) {
    const CREATOR_NAME = "Givy";
    const APP_ID = '936619743392459'; 

    app.get('/stalk/ig', async (req, res) => {
        const { username } = req.query; // Hanya ambil username
        
        if (!username) {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'username' harus disediakan"
            });
        }

        const cleanUser = cleanUsername(username);
        const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUser}`;
        
        const randomIP = generateRandomIP();
        const userAgent = generateRandomUserAgent();

        const headers = {
            'User-Agent': userAgent,
            'X-Forwarded-For': randomIP,
            'X-Real-IP': randomIP,
            'X-Client-IP': randomIP,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': `https://www.instagram.com/${cleanUser}/`,
            'X-IG-App-ID': APP_ID,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.instagram.com',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'DNT': '1',
            'Sec-GPC': '1'
        };

        try {
            const response = await axios.get(url, {
                headers: headers,
                timeout: 10000,
                // Kita izinkan status 404 (Not Found) atau 429 (Rate Limit) untuk ditangani di blok try
                validateStatus: (status) => status >= 200 && status < 500 
            });

            if (response.status === 200) {
                
                // MENGEMBALIKAN DATA RAW/LENGKAP SEBAGAI DEFAULT
                // Periksa jika respons memiliki struktur dasar yang diharapkan sebelum mengembalikan 200 OK
                if (response.data && response.data.data && response.data.data.user) {
                    return res.status(200).json({
                        status: true,
                        creator: CREATOR_NAME,
                        message: "Instagram Stalk Success (Full Data)",
                        result: response.data // <<< INI ADALAH DATA MENTAH LENGKAP
                    });
                } else {
                    // Tangani kasus 200 OK tapi tidak ada data user (misalnya akun private atau edge case)
                    const errorMsg = response.data?.message || `User '${username}' tidak ditemukan atau data tidak lengkap.`;
                    
                    return res.status(404).json({
                        status: false,
                        creator: CREATOR_NAME,
                        message: errorMsg,
                        details: response.data || null
                    });
                }
            } else {
                // Status selain 200 (seperti 404 dari Instagram)
                const errorMsg = response.data?.message || `User '${username}' tidak ditemukan.`;
                
                return res.status(response.status).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: errorMsg,
                    details: response.data || null
                });
            }


        } catch (error) {
            // Error dari jaringan, 401, 429, atau 5xx
            
            let status = 500;
            let message = "Terjadi kesalahan saat mengambil data Instagram.";

            if (error.response) {
                status = error.response.status;
                const data = error.response.data;
                
                if (status === 401 || status === 403) {
                    message = "Akses ditolak (401/403). Server Instagram memblokir request ini.";
                } else if (status === 404) {
                    message = `User '${username}' tidak ditemukan.`;
                } else if (status === 429) {
                    message = "Terlalu banyak permintaan (Rate Limit). Coba lagi nanti.";
                } else {
                    message = data.message || `Error ${status}: Gagal memproses data.`;
                }
            }
            
            console.error(`Instagram Stalk Error (${status}):`, error.message);

            return res.status(status).json({
                status: false,
                creator: CREATOR_NAME,
                message: message,
                details: error.message
            });
        }
    });
};