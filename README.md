# 🚀 GivyAPIs - Complete Setup Guide

Panduan lengkap untuk menjalankan GivyAPIs di VPS dari awal.

---

## 📋 Table of Contents

- [Setup Awal (First Time)](#setup-awal-first-time)
- [Clone & Setup Project](#clone--setup-project)
- [Setup Environment & Config](#setup-environment--config)
- [Test Run](#test-run)
- [Setup PM2 (Production)](#setup-pm2-production)
- [Setup Cloudflare Tunnel (Optional)](#setup-cloudflare-tunnel-optional)
- [Quick Setup TL;DR](#tldr-quick-setup)
- [Troubleshooting](#troubleshooting)

---

## Setup Awal (First Time)

### Update Package Manager & Install Node.js

```bash
# Update package manager
apt update && apt upgrade -y

# Install Node.js (versi 22, sesuai package.json)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs

# Verify versi Node
node --version
npm --version
```

**Output yang diharapkan:**
```
v22.x.x
9.x.x
```

---

## Clone & Setup Project

### Download Repository

```bash
# Clone repo (ganti URL dengan repo mu)
git clone https://github.com/gipicihuy/givy-apis.git
cd givy-apis

# Install dependencies
npm install
```

**Catatan:** Proses `npm install` bisa memakan waktu 2-5 menit tergantung kecepatan internet.

---

## Setup Environment & Config

### 1. Edit `settings.json`

Buka file `settings.json` di root project dan pastikan sudah sesuai:

```json
{
  "name": "GivyAPIs",
  "version": "v1.0",
  "tagline": "A fast, flexible API made for whatever you need!",
  "contact": {
    "telegram": "https://t.me/givyo",
    "github": "https://github.com/gipicihuy"
  },
  "apiSettings": {
    "creator": "Givy",
    "apikey": ["givy-key-2025"]
  }
}
```

**Sesuaikan:**
- `creator` - Nama creator API
- `apikey` - API key untuk autentikasi
- `telegram` & `github` - Link contact mu

### 2. Setup Discord Webhook

Buka file `index.js` dan cari bagian ini:

```javascript
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1428758998420684806/FaQk3iAXjQf5lgn7m_yB-QVqskpj_y_F9FWGTYCJNQU1DZPP8gIId1qOO3S0f4xJD1mQ';
```

**Ganti dengan webhook Discord mu sendiri:**

1. Buka Discord server
2. Settings > Webhooks > Create Webhook
3. Copy webhook URL
4. Paste di `index.js`

---

## Test Run

### Jalankan Sekali untuk Testing

```bash
# Jalankan aplikasi
npm start
```

**Output yang diharapkan:**
```
 Request Route: / 
✓ Load Complete!
✓ Total Routes Loaded: 20
✓ Server is running on port 3000
```

### Test API

Buka di browser atau curl:
```bash
curl http://localhost:3000/
```

Harusnya muncul halaman dokumentasi API.

**Stop aplikasi:** Tekan `Ctrl+C`

---

## Setup PM2 (Production)

PM2 adalah process manager untuk Node.js yang auto-restart jika ada error.

### 1. Install PM2 Global

```bash
npm install -g pm2
```

### 2. Start Aplikasi dengan PM2

```bash
# Start aplikasi
pm2 start index.js --name "givy-apis"

# Cek status
pm2 status

# Lihat logs
pm2 logs givy-apis
```

### 3. Setup Auto-Restart on Reboot

```bash
# Generate startup script
pm2 startup

# Save konfigurasi PM2
pm2 save
```

### 4. Perintah PM2 Berguna

```bash
# Lihat semua proses
pm2 list

# Monitor real-time
pm2 monit

# Restart aplikasi
pm2 restart givy-apis

# Stop aplikasi
pm2 stop givy-apis

# Delete dari PM2
pm2 delete givy-apis

# Save config
pm2 save
```

---

## Setup Cloudflare Tunnel (Optional)

Gunakan Cloudflare Tunnel jika ingin expose API tanpa port forwarding.

### 1. Install Cloudflared

```bash
# Download latest version
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64

# Make executable
chmod +x cloudflared-linux-amd64

# Move ke path global
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# Verify
cloudflared --version
```

### 2. Login & Setup Tunnel

```bash
# Login ke Cloudflare
cloudflared tunnel login

# Ikuti instruksi di browser, copy token jika diminta

# Create tunnel
cloudflared tunnel create givy-apis-tunnel

# List tunnel
cloudflared tunnel list
```

### 3. Create Config File

Buat file `~/.cloudflared/config.yml`:

```yaml
tunnel: givy-apis-tunnel
credentials-file: /root/.cloudflared/[TUNNEL-ID].json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

Ganti:
- `api.yourdomain.com` dengan subdomain kamu
- `[TUNNEL-ID]` dengan ID tunnel yang didapat

### 4. Run Tunnel dengan PM2

```bash
pm2 start tunnel_pm2.json

pm2 save
```

File `tunnel_pm2.json` sudah tersedia di project.

---

## TL;DR Quick Setup

Kalau mau langsung jalan tanpa detail:

```bash
# 1. Clone
git clone https://github.com/gipicihuy/givy-apis.git
cd givy-apis

# 2. Install
npm install

# 3. Setup (edit ini)
# - settings.json (creator, apikey, contact)
# - index.js (webhook Discord)

# 4. Test run
npm start

# 5. Production (dengan PM2)
npm install -g pm2
pm2 start index.js --name givy-apis
pm2 startup
pm2 save
```

---

## Troubleshooting

### ❌ Port 3000 sudah digunakan

```bash
# Cek proses yang pakai port 3000
lsof -i :3000

# Kill proses (ganti PID)
kill -9 [PID]

# Atau ubah port di index.js
const PORT = process.env.PORT || 3001;  # Ganti 3000 jadi 3001
```

### ❌ Node tidak ketemu setelah install

```bash
# Update PATH
source ~/.bashrc

# Atau install ulang
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs
```

### ❌ npm install gagal (Permission denied)

```bash
# Jalankan dengan sudo
sudo npm install

# Atau fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### ❌ PM2 tidak auto-start setelah reboot

```bash
# Re-run startup
pm2 startup

# Copy output yang muncul dan jalankan
# Contoh:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root

# Setelah itu save
pm2 save
```

### ❌ Discord Webhook tidak bekerja

```bash
# Check webhook URL di index.js
# Pastikan format:
# https://discord.com/api/webhooks/[WEBHOOK_ID]/[WEBHOOK_TOKEN]

# Test dengan curl
curl -X POST -H 'Content-type: application/json' \
  --data '{"content":"Test"}' \
  YOUR_WEBHOOK_URL
```

### ❌ API route tidak ter-load

```bash
# Check console output saat startup
# Harusnya ada:
# Loaded Route: status.js
# Loaded Route: tiktok.js
# dll

# Jika tidak, cek:
# 1. File extension .js (bukan .ts)
# 2. File berada di src/api/[kategori]/[file].js
# 3. Export function: module.exports = function(app) { ... }
```

---

## 📞 Support

- 🔗 Telegram: https://t.me/givyo
- 🐙 GitHub: https://github.com/gipicihuy
- 💬 Issues: Buat issue di GitHub

---

**Last Updated:** November 2025  
**Version:** 1.0.0
