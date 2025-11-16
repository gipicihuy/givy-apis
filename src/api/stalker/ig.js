/* File: src/api/stalk/ig.js */
const axios = require('axios');

// Fungsi untuk membuat IP palsu secara acak (membantu menghindari ban sederhana)
function generateRandomIP() {
    return Array.from({length: 4}, () => Math.floor(Math.random() * 256)).join('.');
}

// Fungsi untuk membuat set Cookie palsu (penting untuk endpoint API IG ini)
function generateFakeCookies() {
    const randomString = () => Math.random().toString(36).substring(2, 15);
    const cookies = [
        `ig_did=${randomString()}`,
        `mid=${randomString()}`,
        `csrftoken=${randomString()}`,
        `sessionid=${randomString()}`
    ];
    return cookies.join('; ');
}

// Fungsi utama untuk mengambil data profil Instagram
async function fetchInstagramProfile(username) {
    const fake_ip = generateRandomIP();
    
    // Header yang meniru request dari browser untuk melewati deteksi bot
    const headers = {
        'X-Forwarded-For': fake_ip,
        'X-Real-IP': fake_ip,
        'X-Client-IP': fake_ip,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
        'X-IG-App-ID': '936619743392459', // ID Aplikasi Instagram Web
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': generateFakeCookies()
    };
    
    try {
        const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
        // Timeout 15 detik untuk menghindari request menggantung
        const response = await axios.get(url, { headers, timeout: 15000 });
        
        // Cek jika data yang dikembalikan kosong atau gagal meskipun status 200
        if (!response.data || response.data.status === 'fail' || !response.data.data.user) {
            return { error: 'Gagal mengambil data. Mungkin username tidak ditemukan, akun privat, atau Instagram memblokir request.' };
        }
        
        return response.data;
    } catch (error) {
        // Tangani error Axios seperti timeout atau status non-200
        return { error: error.message || 'Request ke Instagram gagal.' };
    }
}

// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/stalk/ig', async (req, res) => {
        const { username } = req.query; // Ambil parameter 'username' dari query URL
        
        if (!username) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'username' wajib diisi. Contoh: /stalk/ig?username=userig"
            });
        }
        
        try {
            const profile = await fetchInstagramProfile(username);
            
            if (profile.error) {
                // Jika fungsi scraping mengembalikan error
                return res.status(500).json({
                    status: false,
                    creator: 'SeBerryLW',
                    message: profile.error
                });
            }
            
            // Sukses - kembalikan objek user yang berisi semua detail profil
            res.json({
                status: true,
                creator: 'SeBerryLW',
                result: profile.data.user
            });
        } catch (error) {
            // Tangani error yang tidak terduga
            res.status(500).json({
                status: false,
                message: error.message || 'Terjadi kesalahan internal pada server.'
            });
        }
    });
};
