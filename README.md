# P.U.L.S.E. - Barangay 40 & 41, Cavite City
### Public Unified Logistics & Service Engine
Waste Collection & Kagawad Proof Management System with Raspberry Pi Cloud Storage.

## How to Deploy on Render.com (100% Free 24/7 Web App)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for P.U.L.S.E. Barangay 40 and 41"
   git branch -M main
   git remote add origin https://github.com/lloydivanace-lang/Pulse_TrashCollectionV15.git
   git push -u origin main
   ```

2. **Connect to Render**:
   - Go to [Render.com](https://render.com) and log in.
   - Click **"New +"** -> **"Web Service"**.
   - Select your GitHub repository (`Pulse_TrashCollectionV15`).
   - Configure the following settings:
     - **Name**: `pulse-barangay40-41`
     - **Runtime**: `Node`
     - **Branch**: `main`
     - **Build Command**: `npm install --legacy-peer-deps && npm run build`
     - **Start Command**: `npm start` *(Important: Make sure to type 'npm' and not 'nmp')*
     - **Plan**: `Free`
   - Click **"Create Web Service"**.

## Local Development
```bash
npm install
npm run dev
```

## Production Start
```bash
npm run build
npm start
```

## Default Kagawad Credentials
- **Username**: `kagawad41` or `kagawad40` or `admin`
- **Password**: `Kagawad@Cavite2026#Brgy41!`
