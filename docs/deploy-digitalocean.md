# Panduan Deploy Currotter ke DigitalOcean

Dokumen ini menjelaskan semua environment variable yang dibutuhkan dan langkah-langkah deploy ke DigitalOcean App Platform.

> **Catatan Autentikasi:** Currotter saat ini menggunakan Replit Auth (OpenID Connect) yang hanya berjalan di lingkungan Replit. Untuk deploy ke DigitalOcean atau server lain, sistem autentikasi perlu diganti (misalnya Auth0, Clerk, atau implementasi OIDC sendiri). Lihat panduan lengkap di [`MIGRATION_GUIDE.md`](../MIGRATION_GUIDE.md) — Bagian 9 (Authentication Migration).

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

API key untuk vision model GPT-4.1-mini yang melakukan aesthetic scoring. Dapatkan di [cloud.digitalocean.com/gen-ai](https://cloud.digitalocean.com/gen-ai).

| Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `GRADIENT_API_KEY` | `sk-...` | API Key DigitalOcean Gradient AI |

---

### Kelompok 3 — Database

PostgreSQL untuk menyimpan data user dan session.

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

### Kelompok 5 — Google Drive Export (per-user OAuth)

Memungkinkan setiap user mengekspor foto ke **Google Drive mereka sendiri** — bukan ke akun developer. Server hanya menyimpan Client ID dan Secret; token akses tiap user disimpan di session mereka masing-masing dan tidak pernah tersimpan di server secara permanen.

| Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | Client ID dari Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxx` | Client Secret dari Google Cloud Console |

#### Cara Setup Google OAuth (5 menit):

1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Buat atau pilih project → **APIs & Services → Library**
3. Cari **"Google Drive API"** → klik **Enable**
4. Pergi ke **APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Di kolom **Authorized redirect URIs**, tambahkan:
   ```
   https://nama-app-kamu.ondigitalocean.app/api/google/callback
   ```
7. Klik **Create** → salin **Client ID** dan **Client Secret**

> **Tidak ada refresh token yang dibutuhkan.** Aplikasi menggunakan `access_type: online` — token hanya berlaku per-sesi dan langsung dipakai untuk upload, tidak disimpan di database.

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

# Google Drive (per-user OAuth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Total: 9 variables** — tidak ada refresh token, tidak ada Auth0.

---

## Langkah Deploy ke DigitalOcean App Platform

1. Push kode ke GitHub (atau GitLab)
2. Buka [DigitalOcean App Platform](https://cloud.digitalocean.com/apps) → **Create App**
3. Connect ke repository
4. Set konfigurasi build:
   - **Build Command:** `npm run build`
   - **Run Command:** `node dist/index.cjs`
5. Tambahkan semua 9 environment variables di atas
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

## Catatan Penting

### Autentikasi
Seperti disebutkan di awal, Replit Auth tidak bisa dipakai di luar Replit. Untuk deploy production, kamu perlu mengganti modul `server/replit_integrations/auth/` dengan provider OIDC lain. Panduan lengkap ada di [`MIGRATION_GUIDE.md`](../MIGRATION_GUIDE.md) bagian 9.

### Curation Session (In-Memory)
Data sesi kurasi saat ini disimpan di memori server. Artinya, data hilang kalau server di-restart. Untuk production yang stabil, pertimbangkan untuk memindahkan ke tabel PostgreSQL (skema sudah tersedia di `MIGRATION_GUIDE.md` bagian 5).

### DO Spaces — Pembersihan File
Foto yang diupload ke Spaces tidak dihapus otomatis setelah kurasi selesai. Aktifkan **Lifecycle Policy** di bucket untuk menghapus file lama secara otomatis (misalnya setelah 7 hari).

---

*Dokumen ini mencerminkan kondisi kode Currotter per Maret 2026.*
