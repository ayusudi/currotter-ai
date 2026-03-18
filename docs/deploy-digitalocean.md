# Panduan Deploy Currotter ke DigitalOcean

Dokumen ini menjelaskan semua environment variable yang dibutuhkan dan langkah-langkah deploy ke DigitalOcean App Platform.

---

## Cara Kerja Autentikasi

Aplikasi mendukung **dua mode autentikasi** — dipilih otomatis berdasarkan environment variable:

| Kondisi | Provider yang Dipakai |
|---|---|
| `AUTH0_DOMAIN` **diset** | Auth0 (untuk production di DigitalOcean / VPS) |
| `AUTH0_DOMAIN` **tidak diset** | Replit Auth (untuk development di Replit) |

Jadi untuk deploy ke DigitalOcean, kamu cukup mengisi variabel Auth0 — tidak perlu mengubah kode apapun.

---

## Daftar Environment Variables

### Kelompok 1 — DigitalOcean Spaces

Tempat penyimpanan sementara foto selama proses kurasi. Buat bucket di [cloud.digitalocean.com/spaces](https://cloud.digitalocean.com/spaces).

| Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `DO_SPACES_KEY` | `AKIAIOSFODNN7EXAMPLE` | Access Key ID dari Spaces |
| `DO_SPACES_SECRET` | `wJalrXUtnFEMI/K7MDENG/...` | Secret Access Key dari Spaces |
| `DO_SPACES_ENDPOINT` | `sgp1.digitaloceanspaces.com` | Region endpoint (tanpa `https://`) |
| `DO_SPACES_BUCKET` | `currotter-photos` | Nama bucket |

---

### Kelompok 2 — Gradient AI

API key untuk vision model GPT-4.1-mini. Dapatkan di [cloud.digitalocean.com/gen-ai](https://cloud.digitalocean.com/gen-ai).

| Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `GRADIENT_API_KEY` | `sk-...` | API Key DigitalOcean Gradient AI |

---

### Kelompok 3 — Database

| Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `DATABASE_URL` | `postgresql://doadmin:xxx@db-host:25060/defaultdb?sslmode=require` | Connection string dari DO Managed Database |

Cara mendapatkan `DATABASE_URL`:
1. Buka [DigitalOcean → Databases](https://cloud.digitalocean.com/databases)
2. Buat **PostgreSQL** cluster (versi 15+)
3. Setelah aktif, klik **Connection Details** → format **Connection String**
4. Salin string-nya

---

### Kelompok 4 — Session

| Variable | Keterangan |
|---|---|
| `SESSION_SECRET` | String acak min. 32 karakter untuk enkripsi cookie session |

Generate nilai baru:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Kelompok 5 — Auth0 (Wajib untuk Deploy di Luar Replit)

Menggantikan Replit Auth yang hanya berjalan di lingkungan Replit.

| Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `AUTH0_DOMAIN` | `dev-abc123.us.auth0.com` | Domain dari Auth0 tenant kamu |
| `AUTH0_CLIENT_ID` | `xxxxxabc123` | Client ID dari Auth0 Application |
| `AUTH0_CLIENT_SECRET` | `xxxxxsecret` | Client Secret dari Auth0 Application |

#### Cara Setup Auth0 (5 menit):

1. Daftar gratis di [auth0.com](https://auth0.com) → buat tenant baru
2. Pergi ke **Applications → Create Application**
3. Pilih **"Regular Web Application"** → pilih Node.js
4. Di tab **Settings**, catat nilai:
   - **Domain** → `AUTH0_DOMAIN`
   - **Client ID** → `AUTH0_CLIENT_ID`
   - **Client Secret** → `AUTH0_CLIENT_SECRET`
5. Di kolom **"Allowed Callback URLs"**, tambahkan:
   ```
   https://nama-app-kamu.ondigitalocean.app/api/callback
   ```
6. Di kolom **"Allowed Logout URLs"**, tambahkan:
   ```
   https://nama-app-kamu.ondigitalocean.app
   ```
7. Klik **Save Changes**

---

### Kelompok 6 — Google Drive Export (per-user OAuth)

Memungkinkan setiap user mengekspor foto ke **Google Drive mereka sendiri**. Server hanya menyimpan Client ID dan Secret — tidak ada refresh token yang disimpan di server.

| Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | Client ID dari Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxx` | Client Secret dari Google Cloud Console |

#### Cara Setup Google OAuth (5 menit):

1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Pilih atau buat project → **APIs & Services → Library**
3. Cari **"Google Drive API"** → klik **Enable**
4. Pergi ke **APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Di kolom **Authorized redirect URIs**, tambahkan:
   ```
   https://nama-app-kamu.ondigitalocean.app/api/google/callback
   ```
7. Klik **Create** → salin **Client ID** dan **Client Secret**

> Tidak perlu refresh token. Aplikasi menggunakan `access_type: online` — token hanya berlaku per-sesi dan langsung dipakai untuk upload, tanpa disimpan di database.

---

## Ringkasan: Semua Variables yang Dibutuhkan

```bash
# DigitalOcean Spaces
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_ENDPOINT=sgp1.digitaloceanspaces.com
DO_SPACES_BUCKET=

# Gradient AI
GRADIENT_API_KEY=

# Database
DATABASE_URL=postgresql://...

# Session
SESSION_SECRET=

# Auth0 (wajib untuk deploy di luar Replit)
AUTH0_DOMAIN=dev-xxx.us.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# Google Drive (per-user OAuth — tidak perlu refresh token)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Total: 12 variables** — 4 Spaces, 1 Gradient AI, 1 Database, 1 Session, 3 Auth0, 2 Google Drive.

---

## Langkah Deploy ke DigitalOcean App Platform

1. Push kode ke GitHub (atau GitLab)
2. Buka [DigitalOcean App Platform](https://cloud.digitalocean.com/apps) → **Create App**
3. Connect ke repository
4. Set konfigurasi build:
   - **Build Command:** `npm run build`
   - **Run Command:** `node dist/index.cjs`
5. Tambahkan semua 12 environment variables di atas
6. Tambahkan **PostgreSQL** sebagai add-on (otomatis mengisi `DATABASE_URL`)
7. Klik **Deploy**
8. Setelah deploy selesai, jalankan migrasi database dari Console:
   ```bash
   npm run db:push
   ```
9. Update **Authorized redirect URIs** di Google Cloud Console dengan URL production:
   ```
   https://<url-app-kamu>/api/google/callback
   ```

---

## Setelah Deploy: Update Auth0 Callback URLs

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

## Catatan Tambahan

### Curation Session (In-Memory)
Data sesi kurasi disimpan di memori server — hilang kalau server di-restart. Untuk production yang stabil, pertimbangkan memindahkan ke PostgreSQL (skema tersedia di `MIGRATION_GUIDE.md` bagian 5).

### DO Spaces — Pembersihan File Otomatis
Foto yang diupload ke Spaces tidak dihapus otomatis setelah kurasi selesai. Aktifkan **Lifecycle Policy** di bucket untuk menghapus file lama secara otomatis (misalnya setelah 7 hari).

---

*Dokumen ini mencerminkan kondisi kode Currotter per Maret 2026.*
