# T.U.G.O.N. — Barangay 40 (Gumamela) & Barangay 41 (Rosal), Cavite City
## Official Raspberry Pi 4B, Telegram Bot, & Render Deployment Guide

---

## 1. Raspberry Pi 4B Sovereign Cloud Storage Server (Crucial Setup)

Ang `raspberry-pi-server/server.py` ay gumagamit lamang ng **Python 3 Standard Library** (`ThreadingHTTPServer`) — **walang `pip install` o `venv` na kailangan**. Awtomatiko nitong nade-detect ang External Hard Drive (`/media/pi/Vherrsie Back-up/RESEARCH TRASH`), sini-sync ang `pulse_reports.json`, sine-save ang mga `.jpg` na litrato sa `photos/`, at ini-imbak ang mga Logbook snapshots sa `saved_logbooks/`.

### Hakbang A: Patakbuhin ang Pi Storage Server (Port 8000)
Maaari mong pindutin ang **"1-Click Copy Buong Pi Server Command"** sa loob ng **Pi Server** tab ng portal at i-paste diretso sa Terminal ng Raspberry Pi, o patakbuhin mula sa folder:

```bash
cd ~/tugon-server/raspberry-pi-server
python3 server.py 8000
```

Para kusa itong mag-autorun 24/7 kahit mag-brownout:
```bash
bash setup_autostart.sh
```

### Hakbang B: Buksan ang HTTPS Tunnel (Cloudflare o ngrok)
Para maabot ng HTTPS web portal ang iyong Raspberry Pi kahit saan:

**Option 1 — Cloudflare Quick Tunnel (Libre, Walang Account Needed):**
```bash
cloudflared tunnel --url http://localhost:8000
```

**Option 2 — ngrok Tunnel:**
```bash
ngrok http 8000
```

Kopyahin ang nabuong `https://...` link, buksan ang **Kagawad Portal -> Pi Server**, i-paste sa kahon, at pindutin ang **"I-konekta at I-save ang Link"**. Permanente itong mase-save sa server!

*(Suportado rin ang Local Wi-Fi LAN IP gaya ng `http://192.168.1.50:8000` kapag naka-bukas sa parehong local network).*

---

## 2. Telegram Kagawad 24/7 Alert Bot Setup

1. Buksan ang Telegram app at hanapin si **@BotFather**, i-send ang `/newbot`, at kopyahin ang **Bot Token**.
2. Buksan ang bagong gawa mong bot sa Telegram at pindutin ang **`/start`** (o i-add ang bot sa Group Chat ng mga Kagawad at mag-send ng mensahe).
3. Sa **Kagawad Portal -> Telegram**, i-paste ang **Bot Token** at pindutin ang **"Auto-Detect Chat ID"** — kusa nitong mahahanap ang iyong Chat ID!
4. Pindutin ang **"I-verify, I-save, at Magpadala ng Test Alert"**.
   - Bawat bagong report ay magpapadala ng buong detalye, Google Maps pin, kasalukuyang listahan ng active concerns, **at aktuwal na litrato ng basura**.
   - Bawat naresolbang ticket ay magpapadala rin ng **litrato ng proeba (cleanup proof)** ng Kagawad.

---

## 3. Render.com & GitHub Cloud Deployment

- **Build Command:** `npm install --include=dev --legacy-peer-deps && npm run build`
- **Start Command:** `npm start`
- Kasama na ang `render.yaml` at `start.js` para sa zero-error cloud deployment.
