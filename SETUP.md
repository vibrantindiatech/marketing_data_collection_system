# 🪪 CardCapture — Setup Guide

## System is READY. Sirf 2 steps baaki hain:

---

## STEP 1 — Google Drive Folder ID do

1. Apna Google Drive open karo
2. Wo folder open karo jisme aap photos store karna chahte ho
3. URL mein se folder ID copy karo:
   ```
   https://drive.google.com/drive/folders/  <<<YE_COPY_KARO>>>
   ```
4. `config.js` file kholo aur yahan paste karo:
   ```js
   PARENT_FOLDER_ID: 'YAHAN_PASTE_KARO',
   ```

---

## STEP 2 — Google OAuth Client ID setup karo

1. https://console.cloud.google.com/ par jao
2. **New Project** banao (ya existing select karo)
3. Left menu → **APIs & Services** → **Enable APIs**
   - **Google Drive API** enable karo
4. Left menu → **APIs & Services** → **Credentials**
5. **+ Create Credentials** → **OAuth 2.0 Client ID**
6. Application type: **Web Application**
7. **Authorized JavaScript origins** mein add karo:
   ```
   http://localhost
   null
   ```
   *(file:// ke liye `null` add karna hoga)*
8. **Create** click karo → Client ID copy karo
9. `config.js` mein paste karo:
   ```js
   GOOGLE_CLIENT_ID: 'YAHAN_PASTE_KARO.apps.googleusercontent.com',
   ```

---

## APP CHALAO

- `index.html` file ko Chrome/Edge mein open karo (double click)
- **START** button dabao
- **Indore** ya **Mumbai** select karo
- **Connect Drive** button dabao → Google se login karo
- Bas! System ready hai ✅

---

## Drive Folder Structure (auto-banta hai)

```
Aapka Drive Folder/
├── 📁 Indore/                    ← Indore ke general photos
├── 📁 Mumbai/                    ← Mumbai ke general photos  
├── 📁 Indore Visiting Cards/     ← Indore ke card photos
├── 📁 Mumbai Visiting Cards/     ← Mumbai ke card photos
├── 📊 Indore_Data.xlsx           ← Indore ka Excel data
└── 📊 Mumbai_Data.xlsx           ← Mumbai ka Excel data
```

---

## Features

| Feature | Detail |
|---------|--------|
| 📷 Camera | Full screen, front/back switch |
| 📁 Upload | Gallery se choose |
| 💾 Save | Device + Google Drive dono mein |
| 🤖 OCR | Auto card scan (Name, Phone, Email, Company, etc.) |
| 📊 Excel | Auto row append in city-specific file |
| ⏸️ Resume | App band karo, dobara kholo → wahi se continue |
| 🌆 City | Indore = Purple theme, Mumbai = Teal theme |

---

## Files List

```
system/
├── index.html      ← Main app (yahi open karo)
├── style.css       ← Design
├── config.js       ← ⚠️ YAHAN CLIENT ID & FOLDER ID DAALO
├── app.js          ← Main logic
├── drive.js        ← Google Drive integration
├── ocr.js          ← Visiting card scanner
├── excel.js        ← Excel generator
└── session.js      ← Pause/resume session
```
