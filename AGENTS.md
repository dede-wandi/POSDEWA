# Arsitektur Realtime & API Access (Wajib Centrifugo-First)

Aturan wajib untuk seluruh pengembangan di workspace `POSDEWA`:

1. **Semua Realtime Wajib Melalui Centrifugo WebSocket**
   - Seluruh update live (status transaksi, mutasi saldo, katalog/produk, chat, notifikasi, tema) **wajib** memakai jalur event Centrifugo melalui backend Go.
   - **Dilarang** membuat `setInterval` polling berulang atau koneksi realtime langsung ke database (`.channel()` / direct DB stream) dari sisi client.

2. **Hindari Direct/Repeated DB I/O**
   - Akses data harus lewat Go Backend API yang dilindungi cache memori/Redis, dengan cooldown & deduplikasi agar tidak memicu hit berulang ke database.

3. **Clean API Boundaries & Isolasi Partner (`/api/v1/partner/*`)**
   - **Master Superadmin**: `/api/v1/admin/*`
   - **Partner Admin Console**: `/api/v1/partner/*` (terpusat via `MitraApiClient.requestBackend`, dilarang bentrok dengan `/api/v1/admin/*`).
   - **End-User Mobile Apps**: `/api/v1/*` (murni Server-Driven API tanpa fallback data lokal palsu).
   - **Isolasi Mutlak**: Aktivitas produk/harga milik Partner dilarang mengirim notifikasi ke bot Telegram Master, dan UI Partner wajib 100% bebas dari branding "DewaCell" / "Master".

