# Panduan Deploy Currotter ke DigitalOcean

---

## Jawaban Langsung: "Tetap Pakai Kode Replit, Deploy ke DigitalOcean"

Sayangnya **tidak bisa** dilakukan tanpa mengubah kode, karena dua fitur di aplikasi ini bergantung pada **infrastruktur internal Replit** yang hanya bisa diakses dari dalam jaringan Replit:

| Fitur | Masalah di Luar Replit |
|---|---|
| **Login / Auth** | Menggunakan Replit OIDC — server `https://replit.com/oidc` hanya menerima permintaan dari Repl yang terdaftar |
| **Export ke Google Drive** | Menggunakan Replit Connectors — memanggil endpoint internal `REPLIT_CONNECTORS_HOSTNAME` yang tidak bisa diakses dari server lain |

Kalau kamu deploy ke DigitalOcean dengan kode yang sama persis sekarang, aplikasi akan error saat user mencoba login atau export ke Drive.

---

## Solusi Terbaik Tanpa Ganti Kode: Replit Deploy (Sangat Direkomendasikan)

> Ini mungkin yang sebenarnya kamu cari.

Replit punya fitur **Deploy / Publish** yang men-host aplikasimu ke cloud production Replit — bukan lingkungan development. Hasilnya:

- ✅ **Tidak perlu ubah satu baris kode pun**
- ✅ Login Replit Auth tetap berjalan normal
- ✅ Google Drive export tetap berjalan normal
- ✅ DigitalOcean Spaces + Gradient AI tetap berjalan (mereka memang sudah di DO)
- ✅ Dapat domain `nama-app.replit.app` atau bisa pakai domain sendiri
- ✅ Selalu online (tidak mati saat tidak dipakai, berbeda dengan development Repl)
- ✅ Bisa pakai environment variables / secrets yang sudah ada

**Cara deploy:** Klik tombol **"Deploy"** / **"Publish"** di bagian atas Replit, pilih tipe deployment.

**Harga:** mulai ~$7/bulan (Reserved VM), atau pakai Autoscale untuk traffic yang tidak terprediksi.

### Perhatikan ini:
Secara teknis, *infrastruktur utama* Currotter sudah jalan di DigitalOcean:
- Foto disimpan di **DigitalOcean Spaces**
- AI scoring pakai **DigitalOcean Gradient AI**
- Hanya server aplikasinya yang di Replit

Jadi dengan Replit Deploy, arsitekturmu sudah "sebagian besar di DigitalOcean" tanpa effort apapun.

---

## Jika Tetap Ingin Pindah ke DigitalOcean Sepenuhnya

Kamu perlu mengubah dua bagian kode. Ini detail lengkapnya:

### Perubahan yang Diperlukan

#### 1. Ganti Sistem Login (Auth)

File: `server/replit_integrations/auth/replitAuth.ts`

Saat ini menggunakan Replit OIDC yang terikat ke `REPL_ID`. Di luar Replit, server `https://replit.com/oidc` tidak akan menerima request dari server kamu.

**Pilihan pengganti (pilih satu):**
- **Auth0** — paling mudah, free tier tersedia, dokumentasi bagus
- **Clerk** — UI login siap pakai, cocok untuk SaaS
- **Google OAuth langsung** — kalau user base kamu sudah pakai Google semua
- **Username + password sendiri** — paling banyak koding tapi paling bebas

#### 2. Ganti Google Drive Export

File: `server/gdrive.ts`

Saat ini memanggil endpoint internal Replit untuk mendapatkan token OAuth Google. Perlu diganti dengan OAuth Google standar.

---

## Daftar Environment Variables

### Yang Langsung Bisa Dipindahkan (Kode Tidak Perlu Diubah)

| Nama Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `DO_SPACES_KEY` | `AKIAIOSFODNN7EXAMPLE` | Access Key ID dari DigitalOcean Spaces |
| `DO_SPACES_SECRET` | `wJalrXUtnFEMI/K7MDENG/...` | Secret Access Key dari DigitalOcean Spaces |
| `DO_SPACES_ENDPOINT` | `sgp1.digitaloceanspaces.com` | Endpoint region Spaces kamu (tanpa `https://`) |
| `DO_SPACES_BUCKET` | `currotter-photos` | Nama bucket di DigitalOcean Spaces |
| `GRADIENT_API_KEY` | `sk-...` | API Key dari DigitalOcean Gradient AI |
| `SESSION_SECRET` | `string-acak-panjang-min-32-karakter` | Enkripsi session — generate ulang yang baru |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Ganti dengan DO Managed PostgreSQL |

> **Generate `SESSION_SECRET` baru:**
> ```
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Yang Replit-Specific (Perlu Diganti Bersama Kode)

| Nama Variable | Digunakan Untuk | Pengganti |
|---|---|---|
| `REPL_ID` | OIDC Client ID untuk Replit Auth | Credentials dari provider auth baru (Auth0, dll) |
| `ISSUER_URL` | Server OIDC Replit | URL issuer dari provider auth baru |
| `REPLIT_CONNECTORS_HOSTNAME` | Endpoint internal Replit Connectors | Dihapus, ganti dengan `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| `REPL_IDENTITY` | Token identitas Repl | Dihapus |
| `WEB_REPL_RENEWAL` | Token renewal untuk Replit Deployment | Dihapus |

---

## Perbandingan Opsi

| | Replit Deploy | Pindah ke DigitalOcean |
|---|---|---|
| **Ubah kode** | ❌ Tidak perlu | ✅ Perlu (Auth + Google Drive) |
| **Semua fitur jalan** | ✅ Ya | ✅ Ya (setelah diubah) |
| **Harga mulai** | ~$7/bulan | ~$12/bulan + $15 (PostgreSQL) |
| **Effort** | Klik tombol | Beberapa hari kerja |
| **Domain kustom** | ✅ Bisa | ✅ Bisa |
| **Kontrol penuh infrastruktur** | ❌ Terbatas | ✅ Penuh |

---

## Kesimpulan

Untuk **rilis produksi secepat mungkin tanpa ganti kode** → gunakan **Replit Deploy**.

Untuk **kontrol penuh + bebas dari Replit jangka panjang** → migrasi ke DigitalOcean App Platform dengan mengganti Auth dan Google Drive integration.

---

*Dokumen ini dibuat berdasarkan kondisi kode Currotter per Maret 2026.*
