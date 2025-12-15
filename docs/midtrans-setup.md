# Midtrans Payment Gateway Setup

Panduan konfigurasi Midtrans untuk Kalanara Spa Voucher Platform.

## Daftar Isi

1. [Membuat Akun Midtrans](#membuat-akun-midtrans)
2. [Konfigurasi Environment](#konfigurasi-environment)
3. [Sandbox vs Production](#sandbox-vs-production)
4. [Webhook Configuration](#webhook-configuration)
5. [Testing](#testing)

---

## Membuat Akun Midtrans

1. Daftar di [Midtrans](https://midtrans.com)
2. Setelah verifikasi, akses dashboard:
   - **Sandbox**: https://dashboard.sandbox.midtrans.com
   - **Production**: https://dashboard.midtrans.com
3. Buka **Settings > Access Keys** untuk mendapatkan:
   - Server Key
   - Client Key

---

## Konfigurasi Environment

Tambahkan variabel berikut ke file `.env.local`:

```env
# Server Key (RAHASIA - hanya untuk server)
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxx

# Client Key (aman untuk browser)
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxx

# Mode environment
MIDTRANS_IS_PRODUCTION=false
```

### Penjelasan Variabel

| Variable | Deskripsi | Contoh |
|----------|-----------|--------|
| `MIDTRANS_SERVER_KEY` | Kunci rahasia untuk API server-side | `SB-Mid-server-abc123` |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Kunci publik untuk Snap.js | `SB-Mid-client-xyz789` |
| `MIDTRANS_IS_PRODUCTION` | `true` untuk production, `false` untuk sandbox | `false` |

---

## Sandbox vs Production

### Sandbox (Development)

- URL Dashboard: https://dashboard.sandbox.midtrans.com
- Server Key prefix: `SB-Mid-server-`
- Client Key prefix: `SB-Mid-client-`
- Gunakan kartu test untuk simulasi pembayaran

**Kartu Test untuk Sandbox:**

| Tipe | Nomor Kartu | CVV | Exp Date |
|------|-------------|-----|----------|
| Visa (Success) | 4811 1111 1111 1114 | 123 | Any future |
| Visa (Failure) | 4911 1111 1111 1113 | 123 | Any future |
| Mastercard | 5211 1111 1111 1117 | 123 | Any future |

**Metode Pembayaran Test Lainnya:**
- Bank Transfer: Gunakan nomor VA yang diberikan
- GoPay: Scan QR code dengan simulator
- QRIS: Scan dengan simulator

### Production

- URL Dashboard: https://dashboard.midtrans.com
- Server Key prefix: `Mid-server-`
- Client Key prefix: `Mid-client-`
- Transaksi menggunakan uang asli

**Checklist sebelum Production:**
- [ ] Ganti semua key ke production key
- [ ] Set `MIDTRANS_IS_PRODUCTION=true`
- [ ] Konfigurasi webhook URL production
- [ ] Test dengan transaksi kecil terlebih dahulu

---

## Webhook Configuration

Midtrans mengirim notifikasi status pembayaran via webhook.

### Setup Webhook URL

1. Buka Midtrans Dashboard
2. Pergi ke **Settings > Configuration**
3. Set **Payment Notification URL**:
   - Development: Gunakan ngrok atau tunnel service
   - Production: `https://your-domain.com/api/midtrans/notification`

### Webhook URL Format

```
https://your-domain.com/api/midtrans/notification
```

### Development dengan ngrok

Untuk testing webhook di localhost:

```bash
# Install ngrok
npm install -g ngrok

# Jalankan tunnel
ngrok http 3000

# Gunakan URL yang diberikan (contoh: https://abc123.ngrok.io)
# Set di Midtrans: https://abc123.ngrok.io/api/midtrans/notification
```

### Status Transaksi

Webhook akan mengirim notifikasi untuk status berikut:

| Status | Deskripsi | Aksi Sistem |
|--------|-----------|-------------|
| `settlement` | Pembayaran berhasil | Order → COMPLETED, buat voucher |
| `capture` | Pembayaran kartu berhasil | Order → COMPLETED, buat voucher |
| `pending` | Menunggu pembayaran | Order tetap PENDING |
| `deny` | Pembayaran ditolak | Order → FAILED |
| `cancel` | Dibatalkan | Order → FAILED |
| `expire` | Kadaluarsa | Order → FAILED |

---

## Testing

### Unit Tests

```bash
# Jalankan semua test Midtrans
bun run vitest run lib/midtrans app/api/midtrans

# Test spesifik
bun run vitest run lib/midtrans/__tests__/signature.test.ts
```

### Manual Testing Flow

1. **Buat Transaksi**
   - Pilih layanan di halaman utama
   - Isi form checkout
   - Klik "Bayar Sekarang"

2. **Snap Popup**
   - Popup Midtrans akan muncul
   - Pilih metode pembayaran
   - Ikuti instruksi pembayaran

3. **Verifikasi**
   - Cek status order di admin dashboard
   - Pastikan voucher terkirim (jika pembayaran berhasil)

### Simulasi Webhook (Sandbox)

Di Midtrans Sandbox Dashboard:
1. Buka **Transactions**
2. Pilih transaksi
3. Klik **Resend Notification** untuk trigger webhook

---

## Troubleshooting

### Error: "Missing Midtrans configuration"

Pastikan semua environment variable sudah diset:
```bash
# Cek di terminal
echo $MIDTRANS_SERVER_KEY
echo $NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
```

### Webhook tidak diterima

1. Pastikan URL webhook benar di dashboard Midtrans
2. Cek apakah server bisa diakses dari internet
3. Periksa log server untuk error

### Signature verification failed

1. Pastikan `MIDTRANS_SERVER_KEY` benar
2. Cek format notification body dari Midtrans
3. Verifikasi tidak ada modifikasi pada request body

---

## Referensi

- [Midtrans Documentation](https://docs.midtrans.com)
- [Snap Integration Guide](https://docs.midtrans.com/docs/snap-integration-guide)
- [Handling Notifications](https://docs.midtrans.com/docs/https-notification-webhooks)
- [Test Cards](https://docs.midtrans.com/docs/testing-payment-on-sandbox)
