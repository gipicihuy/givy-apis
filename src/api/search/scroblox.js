/* File: src/api/search/scroblox.js */
const axios = require('axios');
const cheerio = require('cheerio');

class RobloxScriptScraper {
    constructor() {
        this.baseUrl = "https://scriptsroblox.net";
        this.timeout = 20000;
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none'
        };
    }

    cleanTitle(title) {
        let cleaned = title.replace(/^WORKINGFREE/, '');
        
        const unnecessary = [
            'WORKING', 'FREE', 'SCRIPT', 'HUB', 'GUI', 'PASTEBIN',
            'AUTO FARM', 'AUTO FISH', '2024', '2025', 'NO KEY', 'KEYLESS'
        ];
        
        unnecessary.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });
        
        cleaned = cleaned.replace(/[|\-–—]+/g, ' - ');
        cleaned = cleaned.replace(/\s+/g, ' ');
        cleaned = cleaned.trim().replace(/^[-\s]+|[-\s]+$/g, '');
        
        return cleaned;
    }

    async searchScripts(query) {
        const url = `${this.baseUrl}/`;
        const params = {
            'story': query,
            'do': 'search',
            'subaction': 'search'
        };
        
        try {
            console.log(`[DEBUG] Searching for: ${query}`);
            console.log(`[DEBUG] Request URL: ${url}?story=${query}&do=search&subaction=search`);
            
            const response = await axios.get(url, { 
                params,
                timeout: this.timeout,
                headers: this.headers,
                maxRedirects: 5,
                httpAgent: undefined,
                httpsAgent: undefined
            });
            
            console.log(`[DEBUG] Response status: ${response.status}`);
            console.log(`[DEBUG] Response length: ${response.data.length}`);
            
            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status} - ${response.statusText}`);
            }
            
            const results = await this.parseSearchResults(response.data, query);
            console.log(`[DEBUG] Found ${results.length} scripts`);
            
            return results;
            
        } catch (error) {
            console.error('[ERROR] Search failed:', error.message);
            console.error('[ERROR] Error code:', error.code);
            console.error('[ERROR] Full error:', error);
            throw error;
        }
    }

    async parseSearchResults(html, query) {
        try {
            const $ = cheerio.load(html);
            const scripts = [];
            const promises = [];
            
            console.log(`[DEBUG] Parsing HTML, total links: ${$('a[href]').length}`);
            
            let linkCount = 0;
            $('a[href]').each((index, element) => {
                const link = $(element);
                const title = link.text().trim();
                const href = link.attr('href');
                
                if (this.isScriptLink(title, href, query)) {
                    linkCount++;
                    promises.push(this.processScriptPage(link, href));
                }
            });
            
            console.log(`[DEBUG] Found ${linkCount} potential script links`);
            
            const results = await Promise.all(promises);
            
            for (const scriptData of results) {
                if (scriptData && scriptData.loadstring) {
                    scripts.push(scriptData);
                }
            }
            
            return scripts;
        } catch (error) {
            console.error('[ERROR] Parse error:', error.message);
            throw error;
        }
    }

    isScriptLink(title, href, query) {
        if (!title || title.length < 10) {
            return false;
        }
            
        const excludeTerms = [
            'home', 'search', 'login', 'register', 'download', 'contact',
            'calendar', 'archive', 'sort by', 'password', 'registration',
            'error', 'codes', 'guide', 'how to', 'tags', 'page'
        ];
        
        if (excludeTerms.some(term => title.toLowerCase().includes(term))) {
            return false;
        }
        
        const queryTerms = query.toLowerCase().split(' ');
        const titleLower = title.toLowerCase();
        
        if (!queryTerms.some(term => titleLower.includes(term))) {
            return false;
        }
        
        const scriptIndicators = ['script', 'hub', 'farm', 'auto'];
        const hasScriptIndicator = scriptIndicators.some(indicator => 
            titleLower.includes(indicator)
        );
        
        return hasScriptIndicator;
    }

    async processScriptPage(link, href) {
        try {
            let fullUrl;
            if (href.startsWith('/')) {
                fullUrl = this.baseUrl + href;
            } else if (href.startsWith('http')) {
                fullUrl = href;
            } else {
                fullUrl = this.baseUrl + '/' + href;
            }
            
            const originalTitle = link.text().trim();
            const cleanedTitle = this.cleanTitle(originalTitle);
            
            const scriptPageContent = await this.getPageContent(fullUrl);
            if (!scriptPageContent) {
                return null;
            }
            
            const downloadUrl = this.findDownloadLink(scriptPageContent, fullUrl);
            if (!downloadUrl) {
                return null;
            }
            
            const loadstring = await this.getLoadstringFromDownload(downloadUrl);
            if (!loadstring) {
                return null;
            }
            
            return {
                originalTitle: originalTitle,
                title: cleanedTitle,
                url: fullUrl,
                downloadUrl: downloadUrl,
                loadstring: loadstring
            };
        } catch (error) {
            console.error('[ERROR] processScriptPage:', error.message);
            return null;
        }
    }

    findDownloadLink(html, pageUrl) {
        const $ = cheerio.load(html);
        
        const downloadLinks = $('a[href*="/download/script/"]');
        if (downloadLinks.length > 0) {
            let href = downloadLinks.first().attr('href');
            if (href.startsWith('/')) {
                return this.baseUrl + href;
            } else if (href.startsWith('http')) {
                return href;
            }
        }
        
        return null;
    }

    async getLoadstringFromDownload(downloadUrl) {
        try {
            const response = await axios.get(downloadUrl, {
                timeout: this.timeout,
                headers: this.headers,
                maxRedirects: 5
            });
            
            const $ = cheerio.load(response.data);
            const loadstring = this.extractLoadstring($);
            return loadstring || null;
                
        } catch (error) {
            console.error('[ERROR] getLoadstringFromDownload:', error.message);
            return null;
        }
    }

    extractLoadstring($) {
        const elements = ['pre', 'code', 'textarea'];
        for (const tag of elements) {
            let found = null;
            $(tag).each((index, element) => {
                const text = $(element).text().trim();
                const loadstring = this.findLoadstringPattern(text);
                if (loadstring) {
                    found = loadstring;
                    return false;
                }
            });
            if (found) return found;
        }
        
        const allText = $('body').text();
        return this.findLoadstringPattern(allText);
    }

    findLoadstringPattern(text) {
        if (!text) return null;
        
        const patterns = [
            /loadstring\(game:HttpGet\(['"]([^'"]+)['"]\)\)\(\)/i,
            /loadstring\(game:HttpGet\(([^)]+)\)\)\(\)/i,
            /loadstring\(([^)]+)\)\(\)/i,
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[0].trim();
            }
        }
        
        return null;
    }

    async getPageContent(url) {
        try {
            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: this.headers,
                maxRedirects: 5
            });
            return response.data;
        } catch (error) {
            console.error('[ERROR] getPageContent:', error.message);
            return null;
        }
    }
}

// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/search/scroblox', async (req, res) => {
        const { query } = req.query;
        const CREATOR_NAME = "Givy";
        
        console.log('\n[API] /search/scroblox called');
        console.log(`[API] Query: ${query}`);
        
        if (!query || query.trim() === '') {
            return res.status(400).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Parameter 'query' wajib diisi. Contoh: /search/scroblox?query=blade+ball"
            });
        }
        
        try {
            const scraper = new RobloxScriptScraper();
            const results = await scraper.searchScripts(query);
            
            if (results.length === 0) {
                return res.status(404).json({
                    status: false,
                    creator: CREATOR_NAME,
                    message: `Tidak ada script ditemukan untuk query: ${query}`
                });
            }
            
            res.status(200).json({
                status: true,
                creator: CREATOR_NAME,
                query: query,
                total: results.length,
                result: results
            });
        } catch (error) {
            console.error("\n[API_ERROR] Scroblox Search Error:", error.message);
            console.error("[API_ERROR] Full stack:", error.stack);
            
            res.status(500).json({
                status: false,
                creator: CREATOR_NAME,
                message: "Gagal melakukan pencarian script Roblox",
                error: error.message,
                debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
};