const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url'); 
const CREATOR_NAME = "Givy";

/**
 * Mengambil informasi file dan link download langsung dari halaman MediaFire.
 * @param {string} url - URL MediaFire.
 * @returns {object} Objek berisi detail file atau error.
 */
async function getMediaFireDownloadLink(url) {
    if (!url.includes('mediafire.com')) {
        return { 
            status: false, 
            message: "URL harus berasal dari mediafire.com." 
        };
    }

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Encoding': 'gzip, deflate, br'
            },
            timeout: 15000 
        });

        const $ = cheerio.load(response.data);

        // Cari elemen link download menggunakan ID #downloadButton (Selector yang stabil)
        const downloadLinkElement = $('a#downloadButton'); 
        const directLink = downloadLinkElement.attr('href');
        
        // Cek apakah link ditemukan
        if (!directLink) {
            
            // Cek apakah file sudah dihapus
            if ($('div.public_check').text().includes('is not available')) {
                 return { status: false, message: "File sudah dihapus (Not Available)." };
            }
            
            // Cek apakah file membutuhkan password
            if ($('#download_password_form').length > 0) {
                 return { status: false, message: "File dilindungi oleh kata sandi." };
            }

            return { status: false, message: "Gagal menemukan link download langsung di halaman. Mungkin struktur HTML telah berubah." };
        }

        // --- LOGIKA EKSTRAKSI NAMA FILE ---
        
        // 1. Coba ambil dari elemen HTML (div.filename atau atribut title)
        let fileName = $('div.dl-info > div.filename').text().trim() || downloadLinkElement.attr('title');
        
        // 2. Jika masih kosong atau 'Unknown', coba ambil dari URL download langsung
        if (!fileName || fileName.toLowerCase() === 'unknown filename') {
            try {
                const urlPath = new URL(directLink).pathname;
                const pathParts = urlPath.split('/');
                
                let extractedName = pathParts.find(part => part.includes('.')) || pathParts[pathParts.length - 1];
                
                fileName = decodeURIComponent(extractedName.replace(/\+/g, ' '));

            } catch (e) {
                fileName = 'Unknown Filename';
            }
        }
        
        // Final fallback
        if (!fileName) fileName = 'Unknown Filename';
        
        // --- LOGIKA EKSTRAKSI DETAIL LAINNYA ---
        
        // Ambil ukuran file
        const fileSize = $('div.dl-info > ul > li:nth-child(1) > span').text().trim() || 'Unknown Size';
        
        // Ambil tipe/versi file (terkadang berisi tanggal, jadi perlu dibersihkan)
        const fileTypeRaw = $('div.dl-info > ul > li:nth-child(2) > span').text().trim() || 'Unknown Type';
        const isDate = /\d{4}-\d{2}-\d{2}/.test(fileTypeRaw);
        let finalFileType = isDate ? 'Unknown Type' : fileTypeRaw;
        
        // --- Perbaikan FileType: Ambil dari ekstensi jika masih Unknown ---
        if (finalFileType === 'Unknown Type' && fileName.includes('.')) {
            const extMatch = fileName.match(/\.([0-9a-z]+)$/i);
            if (extMatch && extMatch[1]) {
                finalFileType = extMatch[1].toUpperCase(); // cth: ZIP, MP4, PDF
            }
        }

        return {
            status: true,
            result: {
                filename: fileName,
                filesize: fileSize,
                filetype: finalFileType, // Menggunakan finalFileType yang sudah diperbaiki
                download_url: directLink
            }
        };

    } catch (error) {
        console.error("MediaFire Scrape Error:", error.message);
        
        let message = "Terjadi kesalahan jaringan atau server MediaFire.";
        if (error.response) {
            message = `Gagal mengakses MediaFire. Status HTTP: ${error.response.status}`;
        }
        
        return { status: false, message: message, details: error.message };
    }
}


// Handler Express
module.exports = function (app) {
    app.get('/download/mediafire', async (req, res) => {
        const { url } = req.query;

        if (!url || url.trim() === '') {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'url' wajib diisi."
            });
        }
        
        console.log(`🔄 Memproses download MediaFire untuk URL: ${url}`);

        const result = await getMediaFireDownloadLink(url);

        // 3. Tangani Hasil
        if (result.status && result.result) {
            
            // ✅ Mengubah format response untuk menghilangkan 'message' dan hanya menyertakan field yang diminta
            return res.status(200).json({
                status: true,
                creator: CREATOR_NAME,
                filename: result.result.filename,
                filesize: result.result.filesize,
                filetype: result.result.filetype,
                download_url: result.result.download_url
            });
            
        } else {
            // Error dari fungsi scraping
            const status = result.message.includes('Not Available') ? 404 : 400;

            return res.status(status).json({
                status: false,
                creator: CREATOR_NAME,
                message: result.message,
                details: result.details || null
            });
        }
    });
};