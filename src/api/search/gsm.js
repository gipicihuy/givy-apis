const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const CREATOR_NAME = "Givy"; // Definisikan di sini

// ===================================
// === FUNGSI SCRAPE & CLEANING (Sudah Anda sediakan) ===
// ===================================

async function gsmarenaCleansearch(query) {
    const searchUrl = 'https://gsmarena.com/results.php3';
    const params = { sQuickSearch: 'yes', sName: query };
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    
    try {
      const response = await axios.get(searchUrl, { params, headers });
      const $ = cheerio.load(response.data);
      
      const searchResults = [];
      const makersDiv = $('.makers');
      
      if (makersDiv.length) {
        makersDiv.find('li').slice(0, 5).each((i, el) => {
          const link = $(el).find('a');
          if (link.length) {
            let title = link.find('span').text().trim() || 'Unknown';
            title = cleanTitle(title);
            
            const img = link.find('img');
            let imageUrl = img.attr('src') || null;
            
            if (imageUrl && imageUrl.includes('pics/')) {
              imageUrl = imageUrl.replace('pics/', 'bigpic/');
            } else if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = new URL(imageUrl, 'https://fdn2.gsmarena.com/vv/').href;
            }
            
            searchResults.push({
              title,
              image: imageUrl,
              link: link.attr('href')
            });
          }
        });
      }
      
      let detailData = null;
      if (searchResults.length) {
        const queryLower = query.toLowerCase();
        let bestMatch = searchResults[0];
        
        // Mencari hasil yang paling cocok
        for (const result of searchResults) {
          const titleLower = result.title.toLowerCase();
          if (titleLower === queryLower || titleLower.startsWith(queryLower)) {
            bestMatch = result;
            break;
          }
        }
        
        const firstResult = bestMatch;
        
        let detailUrl = `https://gsmarena.com/${firstResult.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/ /g, '_')}-details.php`;
        
        try {
          if (firstResult.link) {
            detailUrl = new URL(firstResult.link, 'https://gsmarena.com/').href;
          }
        } catch (e) {}
        
        const detailResponse = await axios.get(detailUrl, { headers });
        const detailSoup = cheerio.load(detailResponse.data);
        
        const specs = extractCleanSpecs(detailSoup);
        
        detailData = {
          title: firstResult.title,
          image: firstResult.image,
          specs
        };
      }
      
      return {
        status: true,
        query,
        total_results: searchResults.length,
        best_match: detailData,
        // phones: searchResults // Dihapus untuk menyederhanakan output
      };
      
    } catch (e) {
      // Jika terjadi kesalahan scraping atau jaringan
      return { status: false, error: e.message };
    }
}

function cleanTitle(title) {
    let cleaned = title.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    cleaned = cleaned.replace(/Apple\s*i\s+([A-Z])/gi, 'Apple i$1');
    cleaned = cleaned.replace(/Vivo\s*i\s+QOO/gi, 'Vivo iQOO');
    cleaned = cleaned.replace(/\bi\s+phone\b/gi, 'iPhone');
    cleaned = cleaned.replace(/\biphone\b/gi, 'iPhone');
    cleaned = cleaned.replace(/\bi\s+pad\b/gi, 'iPad');
    cleaned = cleaned.replace(/\bipad\b/gi, 'iPad');
    cleaned = cleaned.replace(/\bmac\s+book\b/gi, 'MacBook');
    cleaned = cleaned.replace(/\bmacbook\b/gi, 'MacBook');
    cleaned = cleaned.replace(/\biq\s+oo\b/gi, 'iQOO');
    cleaned = cleaned.replace(/ZTE\s*nubia/gi, 'ZTE Nubia');
    
    cleaned = cleaned.replace(/(\w+)\s+([a-z])\s+([A-Z])/gi, function(match, p1, p2, p3) {
      if (p2.toLowerCase() === 'x') return match;
      return p1 + ' ' + p2 + p3;
    });
    
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

function extractCleanSpecs($) {
    const specs = {};
    
    try {
      const tables = $('table');
      
      tables.each((i, table) => {
        const rows = $(table).find('tr');
        
        rows.each((j, row) => {
          const cells = $(row).find('td, th');
          
          if (cells.length >= 2) {
            const key = $(cells[0]).text().trim();
            const value = processCellValue($(cells[1]));
            
            // Filter header kategori dan data yang tidak relevan
            const categoryHeaders = ['Network', 'Launch', 'Body', 'Display', 'Platform', 'Memory', 'Main Camera', 'Selfie camera', 'Sound', 'Comms', 'Features', 'Battery', 'Misc', 'Tests'];
            const cleanedKey = cleanSpecKey(key);

            if (key && key !== '\u00a0' && key !== '' &&
                value && value !== '\u00a0' && value !== '' &&
                !key.match(/^[A-Z\s]+$/) && key.length < 50 &&
                !categoryHeaders.includes(cleanedKey)) {
              
              specs[cleanedKey] = value;
            }
          }
        });
      });
      
      return specs;
      
    } catch (e) {
      console.warn(`Specs extraction warning: ${e.message}`);
      return {};
    }
}

function cleanSpecKey(key) {
    key = key.replace(/:$/, '').trim();
    
    const keyReplacements = {
      'Announced': 'Announced',
      'Status': 'Status',
      'Dimensions': 'Dimensions',
      'Weight': 'Weight',
      'Build': 'Build',
      'SIM': 'SIM',
      'Type': 'Display Type',
      'Size': 'Size',
      'Resolution': 'Resolution',
      'Protection': 'Protection',
      'OS': 'OS',
      'Chipset': 'Chipset',
      'CPU': 'CPU',
      'GPU': 'GPU',
      'Card slot': 'Card slot',
      'Internal': 'Internal',
      'Dual': 'Main Camera',
      'Features': 'Camera Features',
      'Video': 'Video',
      'Single': 'Selfie Camera',
      'Loudspeaker': 'Loudspeaker',
      '3.5mm jack': '3.5mm jack',
      'WLAN': 'WLAN',
      'Bluetooth': 'Bluetooth',
      'Positioning': 'Positioning',
      'NFC': 'NFC',
      'Infrared port': 'Infrared port',
      'Radio': 'Radio',
      'USB': 'USB',
      'Sensors': 'Sensors',
      'Charging': 'Charging',
      'Colors': 'Colors',
      'Models': 'Models',
      'Price': 'Price',
      'Technology': 'Network Technology',
      '2G bands': '2G bands',
      '3G bands': '3G bands',
      '4G bands': '4G bands',
      '5G bands': '5G bands',
      'Speed': 'Speed'
    };
    
    return keyReplacements[key] || key;
}

function processCellValue($cell) {
    try {
      if ($cell.find('br').length) {
        const lines = [];
        
        $cell.contents().each((i, content) => {
          if (content.type === 'text') {
            const text = content.data.trim();
            if (text) lines.push(text);
          } else if (content.name === 'br') {
            return;
          } else if (content.name) {
            const text = cheerio.load(content)('*').text().trim();
            if (text) lines.push(text);
          }
        });
        
        return lines.filter(line => line).join('\n');
      } else {
        return $cell.text().trim();
      }
    } catch (e) {
      return $cell.text().trim();
    }
}


// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/search/device', async (req, res) => {
        const { query } = req.query;
        
        // 1. Validasi Query
        if (!query || query.trim() === '') {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'query' wajib diisi dengan nama perangkat (cth: Samsung S23 Ultra)"
            });
        }
        
        console.log(`🔄 Memproses pencarian spesifikasi perangkat: "${query}"`);

        // 2. Panggil Fungsi Scraping
        const result = await gsmarenaCleansearch(query);

        // 3. Tangani Hasil
        if (result.status) {
            
            if (result.total_results === 0) {
                // Tidak ada hasil ditemukan
                return res.status(404).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: `Tidak ditemukan spesifikasi untuk perangkat: "${query}"`
                });
            }

            // Hasil ditemukan
            return res.status(200).json({
                status: true,
                creator: CREATOR_NAME,
                device: result.best_match.title,
                image: result.best_match.image,
                total_results: result.total_results,
                specs: result.best_match.specs
            });
            
        } else {
            // Error saat scraping
            console.error("Device Search Error:", result.error);
            return res.status(500).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Terjadi kesalahan saat mengambil spesifikasi perangkat.",
                details: result.error
            });
        }
    });
};