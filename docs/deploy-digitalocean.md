# Panduan Deploy Currotter ke DigitalOcean

## Pertanyaan Utama: Apakah Replit Bisa Deploy ke DigitalOcean?

**Tidak secara langsung.** Replit memiliki sistem deployment sendiri (tombol "Deploy / Publish") yang men-host aplikasimu di infrastruktur Replit — bukan di DigitalOcean.

Untuk pindah ke DigitalOcean, kamu perlu melakukan proses berikut:

1. **Export kode** dari Replit ke GitHub (via Git)
2. **Deploy dari GitHub** ke salah satu layanan DigitalOcean:
   - **App Platform** (paling mudah, mirip Heroku)
   - **Droplet** (VPS manual, perlu setup Node.js + Nginx sendiri)
3. **Ganti dua komponen yang Replit-specific** (Auth + Google Drive — lihat bagian bawah)

---

## Daftar Environment Variables

### Kelompok 1 — Langsung Bisa Dipindahkan (Tidak Perlu Perubahan Kode)

Variabel-variabel ini sudah ada di Replit Secrets dan cukup di-copy ke environment baru.

| Nama Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `DO_SPACES_KEY` | `AKIAIOSFODNN7EXAMPLE` | Access Key ID dari DigitalOcean Spaces |
| `DO_SPACES_SECRET` | `wJalrXUtnFEMI/K7MDENG/...` | Secret Access Key dari DigitalOcean Spaces |
| `DO_SPACES_ENDPOINT` | `sgp1.digitaloceanspaces.com` | Endpoint region Spaces kamu (tanpa `https://`) |
| `DO_SPACES_BUCKET` | `currotter-photos` | Nama bucket di DigitalOcean Spaces |
| `GRADIENT_API_KEY` | `sk-...` | API Key dari DigitalOcean Gradient AI (GPT-4.1-mini) |
| `SESSION_SECRET` | `string-acak-panjang-min-32-karakter` | Kunci enkripsi session — buat baru yang kuat |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Connection string PostgreSQL (ganti dengan DO Managed DB) |

> **Catatan `SESSION_SECRET`:** Gunakan string acak yang panjang dan tidak mudah ditebak. Contoh cara generate di terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

> **Catatan `DATABASE_URL`:** Di Replit, ini otomatis di-provision. Di DigitalOcean, kamu perlu membuat **Managed PostgreSQL** cluster sendiri, lalu ambil connection string dari panel kontrolnya.

---

### Kelompok 2 — Replit-Specific (Perlu Diganti / Dihapus)

Variabel-variabel ini hanya ada di lingkungan Replit dan **tidak akan berfungsi** di luar Replit. Kamu perlu mengganti fitur yang menggunakannya.

#### 2a. Replit Auth (Login/Autentikasi)

Kode di `server/replit_integrations/auth/replitAuth.ts` menggunakan:

| Nama Variable | Keterangan |
|---|---|
| `REPL_ID` | ID Repl kamu — digunakan sebagai OIDC Client ID ke `https://replit.com/oidc` |
| `ISSUER_URL` | Default: `https://replit.com/oidc` — server OIDC Replit |

**Di luar Replit, sistem login ini tidak bisa dipakai.** Kamu perlu mengganti auth dengan salah satu opsi:

- **Auth0** — paling mudah, free tier tersedia, OIDC-compatible
- **Google OAuth** — bisa pakai Google Sign-In langsung
- **Clerk** — modern, mudah diintegrasikan
- **Bikin sendiri** — username + password dengan bcrypt + session

#### 2b. Google Drive Export

Kode di `server/gdrive.ts` menggunakan sistem Replit Connectors:

| Nama Variable | Keterangan |
|---|---|
| `REPLIT_CONNECTORS_HOSTNAME` | Host internal Replit untuk mengambil OAuth token Google Drive |
| `REPL_IDENTITY` | Token identitas Repl (untuk Repl environment) |
| `WEB_REPL_RENEWAL` | Token renewal untuk Replit Deployment environment |

**Di luar Replit, Google Drive connector ini tidak akan berfungsi.** Kamu perlu mengganti dengan OAuth Google standar menggunakan variabel berikut yang kamu buat sendiri di [Google Cloud Console](https://console.cloud.google.com):

| Nama Variable Baru | Keterangan |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID dari Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret dari Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | Callback URL OAuth, contoh: `https://app.kamu.com/api/auth/google/callback` |

> Perlu modifikasi kode di `server/gdrive.ts` untuk menggunakan credentials ini langsung, bukan lewat sistem Replit Connectors.

---

## Ringkasan: Yang Bisa Langsung Dipindah vs Yang Perlu Diubah

```
✅ BISA LANGSUNG DIPINDAH (copy-paste nilai dari Replit Secrets):
   DO_SPACES_KEY
   DO_SPACES_SECRET
   DO_SPACES_ENDPOINT
   DO_SPACES_BUCKET
   GRADIENT_API_KEY
   SESSION_SECRET

✅ PERLU DIBUAT BARU (nilai berbeda, kode tidak perlu diubah):
   DATABASE_URL        → buat DO Managed PostgreSQL, ambil connection string baru

⚠️  PERLU GANTI KODE + VARIABEL BARU:
   REPL_ID             → hapus, ganti sistem auth (Auth0, Google OAuth, dll)
   ISSUER_URL          → hapus, ikuti dokumentasi provider auth baru
   REPLIT_CONNECTORS_HOSTNAME  → hapus, ganti dengan Google OAuth standar
   REPL_IDENTITY       → hapus
   WEB_REPL_RENEWAL    → hapus
```

---

## Opsi Hosting di DigitalOcean

### Opsi A — App Platform (Direkomendasikan untuk Mulai)

Paling mudah dan mirip pengalaman di Replit:

1. Push kode ke GitHub
2. Buka [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
3. Klik "Create App" → pilih repository GitHub kamu
4. Set **Build Command:** `npm run build`
5. Set **Run Command:** `npm start` (atau `node dist/server/index.js`)
6. Tambahkan semua environment variables dari daftar di atas
7. Tambahkan **PostgreSQL** sebagai add-on (otomatis set `DATABASE_URL`)
8. Deploy

**Harga perkiraan:** mulai ~$12/bulan (Basic instance) + $15/bulan untuk PostgreSQL

### Opsi B — Droplet (VPS Manual)

Untuk kontrol penuh:

1. Buat Droplet Ubuntu minimal 2GB RAM
2. Install Node.js 20+, PostgreSQL (atau pakai Managed DB terpisah)
3. Clone repo dari GitHub
4. Setup environment variables di file `.env`
5. Jalankan dengan `pm2` agar tetap hidup setelah reboot
6. Setup Nginx sebagai reverse proxy ke port 5000
7. Pasang SSL dengan Certbot (Let's Encrypt gratis)

---

## Urutan Kerja yang Disarankan

1. **Push kode ke GitHub** (jika belum)
2. **Buat Google Cloud project** → setup OAuth credentials untuk Google Drive
3. **Pilih provider auth** (Auth0 paling cepat) → daftar, dapatkan credentials
4. **Modifikasi kode** `replitAuth.ts` dan `gdrive.ts` untuk tidak bergantung pada Replit
5. **Test lokal** dengan `.env` file yang berisi semua variabel baru
6. **Deploy ke App Platform** atau Droplet
7. **Jalankan database migration** (`npm run db:push`)

---

*Dokumen ini dibuat berdasarkan kondisi kode Currotter per Maret 2026.*
