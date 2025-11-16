/* File: src/api/stalker/ngl.js */
const axios = require('axios');

function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function extractProfilePicture(htmlContent) {
    const patterns = [
        /https:\/\/firebasestorage\.googleapis\.com[^\s"']+/g,
        /"profilePicture":"([^"]+firebasestorage[^"]+)"/g,
        /"avatar":"([^"]+firebasestorage[^"]+)"/g,
        /profilePicture:\s*["']([^"']+firebasestorage[^"']+)["']/g,
    ];
    
    for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        for (const match of matches) {
            let url = match[1] || match[0];
            
            if (url && url.includes('firebasestorage.googleapis.com')) {
                url = url.replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/^['"]|['"]$/g, '');
                return url;
            }
        }
    }
    
    return null;
}

async function checkNglProfile(username) {
    const url = `https://ngl.link/${username}`;
    const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    };

    try {
        const response = await axios.get(url, {
            headers: headers,
            maxRedirects: 5,
            timeout: 10000,
            validateStatus: (status) => status >= 200 && status < 500
        });

        const finalUrl = response.request.res.responseUrl;
        const status = response.status;
        const htmlContent = response.data.toLowerCase();

        const nglIndicators = [
            'send anonymous messages', 'ask me anything', 'ngl.link',
            'anonymous questions', 'type your question', 'submit'
        ];
        const errorIndicators = [
            'page not found', 'does not exist', 'not found', '404', 'error'
        ];
        
        const foundNglIndicators = nglIndicators.filter(indicator => htmlContent.includes(indicator)).length;
        const foundErrorIndicators = errorIndicators.filter(indicator => htmlContent.includes(indicator)).length;
        
        let profileStatus = 'UNCLEAR';
        let statusMessage = `Username ${username} - Status tidak jelas`;

        if (!finalUrl.includes("ngl.link")) {
            profileStatus = 'REDIRECTED';
            statusMessage = `Redirected ke URL lain.`;
        } else if (status === 404 || foundErrorIndicators >= 2) {
            profileStatus = 'NOT_FOUND';
            statusMessage = `username ga ditemukan ygy`;
        } else if (status === 200 && foundNglIndicators >= 2) {
            profileStatus = 'VALID';
            statusMessage = `profil ngl valid ygy`;
        } else if (status !== 200) {
             profileStatus = 'HTTP_ERROR';
             statusMessage = `HTTP Error ${status}.`;
        }
        
        let profilePicture = null;
        if (profileStatus === 'VALID' || profileStatus === 'UNCLEAR') {
            profilePicture = extractProfilePicture(response.data);
        }

        return {
            status: profileStatus,
            username: username,
            profilePicture: profilePicture,
            message: statusMessage,
            valid: profileStatus === 'VALID'
        };

    } catch (e) {
        if (e.response && e.response.status === 404) {
             return { status: 'NOT_FOUND', username: username, profilePicture: null, message: `Username tidak ditemukan (HTTP 404)`, valid: false };
        }
        if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
             return { status: 'TIMEOUT', username: username, profilePicture: null, message: `Request timeout ke NGL.link`, valid: false };
        }
        return {
            status: 'ERROR',
            username: username,
            profilePicture: null,
            message: `Terjadi kesalahan saat mengecek username: ${e.message}`,
            valid: false
        };
    }
}


module.exports = function (app) {
    
    app.get('/stalk/ngl', async (req, res) => {
        const { username } = req.query;
        
        if (!username) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'username' wajib diisi. Contoh: /stalk/ngl?username=namauser"
            });
        }
        
        try {
            const result = await checkNglProfile(username);
            
            if (result.status === 'ERROR' || result.status === 'TIMEOUT') {
                return res.status(500).json({
                    status: false,
                    creator: 'Givy ygy',
                    message: result.message,
                    username: username
                });
            }
            
            res.json({
                status: true,
                creator: 'Givy ygy',
                result: {
                    username: result.username,
                    status: result.status,
                    message: result.message,
                    valid: result.valid,
                    profilePicture: result.profilePicture,
                    profileUrl: `https://ngl.link/${result.username}`
                }
            });
            
        } catch (error) {
            console.error("Error in /stalk/ngl:", error);
            res.status(500).json({
                status: false,
                message: error.message || 'Terjadi kesalahan internal pada server.',
                username: username
            });
        }
    });
};
