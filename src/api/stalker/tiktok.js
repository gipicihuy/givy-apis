/* File: src/api/stalker/tiktok.js */
const axios = require("axios");
const crypto = require("crypto"); // Module crypto di-require untuk CommonJS

// ===========================================
// === FUNGSI SPOOF HEAD (Implementasi Anda) ===
// ===========================================
const SpoofHead = (extra = {}) => {
    // Generate IP 10.x.x.x acak
    const ip = [10, crypto.randomInt(256), crypto.randomInt(256), crypto.randomInt(256)].join(".");
    const genericHeaders = {
        // Headers untuk Spoofing IP
        "x-forwarded-for": ip, 
        "x-real-ip": ip,
        "client-ip": ip,
        "x-client-ip": ip,
        "x-cluster-client-ip": ip,
        "x-original-forwarded-for": ip
    };
    return {
        ...genericHeaders,
        ...extra
    };
};
// ===========================================


class TikTokStalker {
    constructor() {
        // Diinisialisasi
    }

    _getHeaders() {
        return {
            // Header standar Anda
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.5",
            Connection: "keep-alive",
            "Cache-Control": "max-age=0",
            // Tambahkan header Spoof
            ...SpoofHead() 
        };
    }

    async _fetch(username) {
        const url = `https://www.tiktok.com/@${username}`;
        try {
            const response = await axios.get(url, {
                headers: this._getHeaders(),
                timeout: 15e3
            });
            return response.data;
        } catch (error) {
            throw new Error(`Gagal mengambil data dari TikTok: ${error.message}`);
        }
    }

    _extract(html) {
        const pattern = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/s;
        const match = html.match(pattern);
        if (!match || !match[1]) throw new Error("Data universal tidak ditemukan. (Kemungkinan user tidak ada/private)");
        try {
            return JSON.parse(match[1]);
        } catch (error) {
            throw new Error(`Gagal parsing JSON: ${error.message}`);
        }
    }

    _findData(jsonData, username) {
        const scope = jsonData?.__DEFAULT_SCOPE__;
        if (!scope) throw new Error("Objek __DEFAULT_SCOPE__ tidak ditemukan.");
        let userInfo = scope["webapp.user-detail"]?.userInfo;
        
        if (userInfo?.user?.uniqueId?.toLowerCase() !== username) {
            for (const key in scope) {
                const potentialInfo = scope[key]?.userInfo;
                if (potentialInfo?.user?.uniqueId?.toLowerCase() === username) {
                    userInfo = potentialInfo;
                    break;
                }
            }
        }
        
        if (!userInfo || !userInfo.user) throw new Error("Data userInfo yang valid tidak dapat ditemukan.");
        return userInfo;
    }

    _format(userInfo) {
        const user = userInfo.user ?? {};
        const stats = userInfo.stats ?? {};
        const statsV2 = userInfo.statsV2 ?? {};
        const formatTs = timestamp => {
            if (!timestamp) return "Unknown";
            const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
            const dt = new Date(timestamp * 1e3);
            const dayName = days[dt.getDay()];
            const formattedDate = `${dt.getDate().toString().padStart(2, "0")}-${(dt.getMonth() + 1).toString().padStart(2, "0")}-${dt.getFullYear()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}:${dt.getSeconds().toString().padStart(2, "0")}`;
            return `${timestamp} (${dayName}, ${formattedDate})`;
        };
        return {
            id: user.id,
            shortId: user.shortId,
            uniqueId: user.uniqueId,
            nickname: user.nickname,
            signature: user.signature?.trim() || "No bio yet",
            secUid: user.secUid,
            timestamps: {
                createTime: formatTs(user.createTime),
                nickNameModifyTime: formatTs(user.nickNameModifyTime),
                uniqueIdModifyTime: formatTs(user.uniqueIdModifyTime)
            },
            profile: {
                language: user.language || "Unknown",
                region: user.region || "Unknown",
                isVerified: user.verified ?? false,
                isUnderAge18: user.isUnderAge18 ?? false,
                isEmbedBanned: user.isEmbedBanned ?? false
            },
            avatars: {
                larger: user.avatarLarger,
                medium: user.avatarMedium,
                thumb: user.avatarThumb
            },
            privacy: {
                isPrivate: user.privateAccount ?? false,
                isSecret: user.secret ?? false,
                commentSetting: user.commentSetting,
                duetSetting: user.duetSetting,
                stitchSetting: user.stitchSetting,
                downloadSetting: user.downloadSetting,
                followingVisibility: user.followingVisibility,
                profileEmbedPermission: user.profileEmbedPermission,
                showFavoriteList: user.openFavorite ?? false
            },
            social: {
                relation: user.relation,
                friendCount: stats.friendCount ?? 0
            },
            activity: {
                roomId: user.roomId || "Not Live",
                storyStatus: user.UserStoryStatus,
                nowInvitationCardUrl: user.nowInvitationCardUrl || null,
                eventList: user.eventList || []
            },
            commerce: user.commerceUserInfo ? {
                isCommerceUser: user.commerceUserInfo.commerceUser ?? false,
                category: user.commerceUserInfo.category || "N/A",
                hasCategoryButton: user.commerceUserInfo.categoryButton ?? false,
                isTTSeller: user.ttSeller ?? false
            } : null,
            tabs: user.profileTab ? {
                showMusic: user.profileTab.showMusicTab ?? false,
                showQuestion: user.profileTab.showQuestionTab ?? false,
                _showPlaylist: user.profileTab.showPlayListTab ?? false,
                canShowPlaylist: user.canExpPlaylist ?? false
            } : null,
            miscellaneous: {
                ftc: user.ftc ?? false,
                isADVirtual: user.isADVirtual ?? false,
                isOrganization: user.isOrganization ?? 0,
                suggestAccountBind: user.suggestAccountBind ?? false,
                recommendReason: user.recommendReason || ""
            },
            stats: stats,
            statsV2: statsV2,
            itemList: userInfo.itemList || []
        };
    }

    async stalker({ username, ...rest }) {
        if (!username || typeof username !== "string") {
            throw new Error("Username harus disediakan.");
        }
        
        const cleanedUsername = username.replace('@', '').toLowerCase();

        try {
            const html = await this._fetch(cleanedUsername);
            const jsonData = this._extract(html);
            const userInfo = this._findData(jsonData, cleanedUsername);
            const finalResult = this._format(userInfo);
            
            return {
                ...finalResult,
                ...rest
            };
        } catch (error) {
            throw error; 
        }
    }
}


// ===================================
// === MODUL EXPRESS ENDPOINT ===
// ===================================
module.exports = function (app) {
    app.get('/stalker/tiktok', async (req, res) => {
        
        if (global.totalreq !== undefined) {
             global.totalreq++;
        }
        
        const { username } = req.query; 
        
        if (!username) {
            if (typeof queueLog === 'function') {
                // Asumsi queueLog ada di index.js
                queueLog({ method: req.method, status: 400, url: req.originalUrl, duration: 0, error: "Missing 'username' parameter" });
            }
            return res.status(400).json({
                status: false,
                message: "Parameter 'username' wajib diisi. Contoh: /api/stalker/tiktok?username=namauser"
            });
        }
        
        try {
            const api = new TikTokStalker();
            const response = await api.stalker({ username });
            
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 200, url: req.originalUrl, duration: 0 }); 
            }
            
            res.status(200).json({
                status: true,
                creator: 'Givy',
                result: response
            });
        } catch (error) {
            if (typeof queueLog === 'function') {
                queueLog({ method: req.method, status: 500, url: req.originalUrl, duration: 0, error: error.message });
            }
            
            res.status(500).json({
                status: false,
                message: error.message || 'Terjadi kesalahan internal pada server saat mengambil data TikTok.'
            });
        }
    });
};
