# Panduan Deploy Currotter ke DigitalOcean

## Strategi yang Dipakai

Kode aplikasi sudah dimodifikasi agar bisa berjalan di **dua mode**:

- **Mode Replit** — bila `AUTH0_DOMAIN` tidak ada, otomatis pakai Replit Auth (untuk development di Replit)
- **Mode Production** — bila `AUTH0_DOMAIN` ada, pakai Auth0 + Google OAuth langsung (untuk deploy ke DigitalOcean atau server manapun)

Tidak ada yang rusak selama development. Kamu hanya perlu menambahkan env vars baru saat deploy ke DigitalOcean.

---

## Daftar Lengkap Environment Variables untuk DigitalOcean

### Kelompok 1 — Copy dari Replit Secrets (nilai sama persis)

| Nama Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `DO_SPACES_KEY` | `AKIAIOSFODNN7EXAMPLE` | Access Key dari DigitalOcean Spaces |
| `DO_SPACES_SECRET` | `wJalrXUtnFEMI/K7MDENG/...` | Secret Key dari DigitalOcean Spaces |
| `DO_SPACES_ENDPOINT` | `sgp1.digitaloceanspaces.com` | Region endpoint Spaces (tanpa `https://`) |
| `DO_SPACES_BUCKET` | `currotter-photos` | Nama bucket di Spaces |
| `GRADIENT_API_KEY` | `sk-...` | API Key DigitalOcean Gradient AI |
| `SESSION_SECRET` | `string-acak-64-karakter` | Generate ulang yang baru — lihat cara di bawah |

> **Generate SESSION_SECRET baru:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

### Kelompok 2 — Buat Baru (nilai berbeda, kode tidak perlu diubah)

| Nama Variable | Keterangan |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL dari DigitalOcean Managed Database |

Cara dapat `DATABASE_URL`:
1. Buka [DigitalOcean → Databases](https://cloud.digitalocean.com/databases)
2. Buat **PostgreSQL** cluster (versi 15+)
3. Setelah cluster aktif, klik **"Connection Details"** → pilih format **Connection String**
4. Copy string seperti: `postgresql://doadmin:xxxxx@db-host:25060/defaultdb?sslmode=require`

---

### Kelompok 3 — Auth0 (Menggantikan Replit Auth)

#### Langkah Setup Auth0:

1. Daftar gratis di [auth0.com](https://auth0.com) → buat tenant baru
2. Pergi ke **Applications → Create Application**
3. Pilih **"Regular Web Application"** → pilih Node.js
4. Di tab **Settings**, catat nilai berikut:
   - **Domain** → ini adalah `AUTH0_DOMAIN`
   - **Client ID** → ini adalah `AUTH0_CLIENT_ID`
   - **Client Secret** → ini adalah `AUTH0_CLIENT_SECRET`
5. Di kolom **"Allowed Callback URLs"**, tambahkan URL aplikasimu:
   ```
   https://nama-app-kamu.ondigitalocean.app/api/callback
   ```
   Tambahkan juga URL development Replit kamu kalau ingin test Auth0 dari Replit:
   ```
   https://xxx.kirk.replit.dev/api/callback
   ```
6. Di kolom **"Allowed Logout URLs"**, tambahkan:
   ```
   https://nama-app-kamu.ondigitalocean.app
   ```
7. Klik **Save Changes**

| Nama Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `AUTH0_DOMAIN` | `dev-abc123.us.auth0.com` | Domain dari Auth0 tenant kamu |
| `AUTH0_CLIENT_ID` | `xxxxxabc123` | Client ID dari Auth0 Application |
| `AUTH0_CLIENT_SECRET` | `xxxxxsecret` | Client Secret dari Auth0 Application |

---

### Kelompok 4 — Google Drive (Menggantikan Replit Connectors)

Kamu perlu membuat **satu akun Google** yang akan menjadi tempat folder hasil export dikirimkan. Token yang disimpan adalah milik akun ini (bukan per-user).

#### Langkah Setup Google Drive OAuth:

**A. Buat Google Cloud Project & Credentials:**

1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Buat project baru (atau pakai yang sudah ada)
3. Aktifkan **Google Drive API**:
   - Cari "Google Drive API" di search bar
   - Klik **Enable**
4. Buka **APIs & Services → Credentials**
5. Klik **"+ Create Credentials" → OAuth 2.0 Client IDs**
6. Application type: **Web application**
7. Di **"Authorized redirect URIs"**, tambahkan:
   ```
   https://developers.google.com/oauthplayground
   ```
   *(Ini hanya untuk langkah mendapatkan refresh token — nanti bisa dihapus)*
8. Klik **Create** → catat **Client ID** dan **Client Secret**

**B. Dapatkan Refresh Token:**

1. Buka [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Klik ikon **gear (⚙️)** di kanan atas → centang **"Use your own OAuth credentials"**
3. Masukkan Client ID dan Client Secret dari langkah sebelumnya
4. Di kolom kiri, cari **"Drive API v3"** → pilih scope:
   ```
   https://www.googleapis.com/auth/drive.file
   ```
5. Klik **"Authorize APIs"** → login dengan akun Google yang akan menjadi tujuan export
6. Klik **"Exchange authorization code for tokens"**
7. Salin **Refresh token** yang muncul

| Nama Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | Client ID dari Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxx` | Client Secret dari Google Cloud Console |
| `GOOGLE_REFRESH_TOKEN` | `1//0xxxxx` | Refresh token yang didapat dari OAuth Playground |

---

## Ringkasan: Semua Variables yang Dibutuhkan di DigitalOcean

```
# DigitalOcean Spaces (copy dari Replit)
DO_SPACES_KEY=...
DO_SPACES_SECRET=...
DO_SPACES_ENDPOINT=sgp1.digitaloceanspaces.com
DO_SPACES_BUCKET=currotter-photos

# Gradient AI (copy dari Replit)
GRADIENT_API_KEY=sk-...

# Session (generate baru)
SESSION_SECRET=...

# Database (dari DO Managed PostgreSQL)
DATABASE_URL=postgresql://...

# Auth0 (dari Auth0 dashboard)
AUTH0_DOMAIN=dev-xxx.us.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...

# Google Drive (dari Google Cloud Console + OAuth Playground)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

**Total: 13 variables** — 5 copy dari Replit, 1 buat baru (database), 7 buat baru (Auth0 + Google Drive).

---

## Deploy ke DigitalOcean App Platform

1. Push kode ke GitHub
2. Buka [DigitalOcean App Platform](https://cloud.digitalocean.com/apps) → **Create App**
3. Connect ke repository GitHub kamu
4. Set **Build Command:** `npm run build`
5. Set **Run Command:** `node dist/server/index.js`
   *(atau sesuaikan dengan output build kamu)*
6. Tambahkan semua 13 environment variables di atas
7. Tambahkan **PostgreSQL** sebagai add-on (otomatis isi `DATABASE_URL`)
8. Klik **Deploy**
9. Setelah deploy selesai, buka URL app kamu
10. Jalankan database migration: masuk ke console → `npm run db:push`

---

## Setelah Deploy: Perbarui Auth0 Callback URLs

Setelah dapat URL production dari DigitalOcean (contoh: `https://currotter-abc12.ondigitalocean.app`):

1. Buka Auth0 dashboard → Application kamu
2. Update **Allowed Callback URLs**:
   ```
   https://currotter-abc12.ondigitalocean.app/api/callback
   ```
3. Update **Allowed Logout URLs**:
   ```
   https://currotter-abc12.ondigitalocean.app
   ```

---

*Dokumen ini dibuat berdasarkan kondisi kode Currotter per Maret 2026.*
