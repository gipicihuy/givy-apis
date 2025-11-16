/* File: src/api/download/spotify.js */
const axios = require("axios");
const cheerio = require('cheerio'); // Menggunakan require untuk cheerio

class Spotify {
  constructor(url) {
    if (!url) throw new Error("Parameter 'url' wajib diisi.");
    this.url = url;
    this.baseURL = "https://spotmate.online";
    this.userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
  }

  async getToken() {
    const res = await axios.get(this.baseURL, {
      headers: { "User-Agent": this.userAgent },
    });
    const html = res.data;
    const match = html.match(
      /<meta[^>]+(csrf[-_]?token|csrf|csrf_token)[^>]+content=["']([^"']+)["']/
    );
    if (!match) throw new Error("Token CSRF tidak ditemukan");
    const token = match[2];
    const cookie = (res.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");
    return { token, cookie };
  }

  async run() {
   try {
    const { token, cookie } = await this.getToken();
    const headers = {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": token,
      Cookie: cookie,
      Referer: this.baseURL + "/",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": this.userAgent,
    };
    let result = {
        metadata: {},
        downloadUrl: null
     }
     
    // --- 1. Ambil Metadata dari Spotmate ---
    let r = await axios
      .post(this.baseURL + "/getTrackData", { spotify_url: this.url }, { headers })
      .catch((e) => e.response);
      
    if (r.status !== 200) throw new Error("Gagal ambil data metadata dari Spotmate. Pastikan URL valid.");
    
    const meta = r.data;
     result.metadata = {
            title: meta.name,
            id: meta.id,
            images: meta.album.images[0].url,
            duration: this.formatTime(meta.duration_ms),
            artist: meta.artists[0].name
       }

    // --- 2. Ambil Lirik dari Genius (Error handling lebih baik) ---
    const lyricUrl = `https://genius.com/${result.metadata.artist.split(" ").join("-").toLowerCase()}-${result.metadata.title.split(" ").join("-").toLowerCase()}-lyrics`;
    
    try {
        const { data } = await axios.get(lyricUrl, {
            headers: {
                'User-Agent': this.userAgent // Gunakan UserAgent yang sama
            },
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400
        });

        const $ = cheerio.load(data);
        const lyricsContainers = $('[data-lyrics-container="true"]');
        let lyrics = '';

        lyricsContainers.each((i, container) => {
            const containerText = $(container).html();
            const textWithBreaks = containerText
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/div>/gi, '\n')
                .replace(/<[^>]+>/g, '');
            lyrics += textWithBreaks + '\n';
        });

        result.metadata.lyrics = lyrics.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n').split(';').pop() || 'Lyrics not found'

    } catch (e) {
        result.metadata.lyrics = 'Lyrics not found (Failed to fetch from Genius)';
    }

    // --- 3. Buat CDN Download URL (Tanpa mengunduh Buffer) ---
    const cdnURL = `https://cdn-spotify-247.zm.io.vn/download/${result.metadata.id}/syaiiganteng?name=${encodeURIComponent(result.metadata.title)}&artist=${encodeURIComponent(result.metadata.artist)}`
    result.downloadUrl = cdnURL
    
    return result;
  } catch (error) {
    // Re-throw error agar ditangkap oleh Express.js
    throw error;
   }
  }

  formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
 }
}


// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/download/spotify', async (req, res) => {
        // Increment request counter di index.js
        global.totalreq++; 

        const { url } = req.query; // Ambil parameter 'url' dari query URL
        
        if (!url) {
            // Log 400 error
            queueLog({ method: req.method, status: 400, url: req.originalUrl, duration: 0, error: "Missing 'url' parameter" });
            return res.status(400).json({
                status: false,
                message: "Parameter 'url' wajib diisi. Contoh: /api/download/spotify?url=URL_LAGU_SPOTIFY"
            });
        }
        
        try {
            const spotify = new Spotify(url);
            const result = await spotify.run();
            
            // Log sukses
            queueLog({ method: req.method, status: 200, url: req.originalUrl, duration: 0 }); // Atur durasi yang benar jika Anda mengukur
            
            // Sukses - kembalikan objek JSON
            res.json({
                status: true,
                creator: 'Givy',
                result: {
                    metadata: result.metadata,
                    downloadUrl: result.downloadUrl
                }
            });
        } catch (error) {
            // Log error
            queueLog({ method: req.method, status: 500, url: req.originalUrl, duration: 0, error: error.message });
            
            // Tangani error yang tidak terduga
            res.status(500).json({
                status: false,
                message: error.message || 'Terjadi kesalahan internal pada server saat mengambil data Spotify.'
            });
        }
    });
};
