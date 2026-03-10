# Plan Refactor UX Checkout Kalanara Spa

## Ringkasan
Refactor checkout difokuskan pada 3 hal: mempersingkat friction form, memperjelas tujuan pengiriman voucher, dan memperhalus handoff ke pembayaran tanpa blank popup/blank loading state. Implementasi tetap memakai flow dan endpoint yang ada, tanpa migration database, dengan perubahan utama pada UI checkout, validasi request Scalev, dan copy/behavior halaman status pembayaran.

## Outcome yang Harus Tercapai
- Checkout terasa lebih pendek karena user hanya melihat field yang relevan.
- Opsi `Kirim ke Saya` tidak lagi meminta kontak penerima yang sebenarnya tidak dipakai untuk delivery.
- User selalu melihat preview jelas: voucher akan dikirim ke siapa dan lewat channel apa.
- Handoff ke pembayaran tidak lagi terasa glitchy; popup jika dipakai harus berisi loading shell yang branded, bukan blank page.
- Mobile punya CTA yang selalu mudah dijangkau.
- Success/pending page menjelaskan langkah berikutnya dengan jelas.

## Scope Implementasi
- Refactor UI di [checkout-page-client.tsx](D:/Projects/Vibe%20Code/kalanaraspa/app/checkout/[id]/checkout-page-client.tsx)
- Update kontrak type di [types.ts](D:/Projects/Vibe%20Code/kalanaraspa/lib/scalev/types.ts)
- Update validasi API di [create-payment/route.ts](D:/Projects/Vibe%20Code/kalanaraspa/app/api/scalev/create-payment/route.ts)
- Update order creation di [orders.ts](D:/Projects/Vibe%20Code/kalanaraspa/lib/actions/orders.ts)
- Update delivery/voucher fallback logic di [voucher-service.ts](D:/Projects/Vibe%20Code/kalanaraspa/lib/payment/voucher-service.ts)
- Update status/success UX di [success/page.tsx](D:/Projects/Vibe%20Code/kalanaraspa/app/checkout/success/page.tsx)
- Tambah/ubah test di test checkout yang sudah ada

## Spesifikasi UI Checkout
### Struktur Halaman
- Pertahankan layout 2 kolom desktop dan 1 kolom mobile.
- Kolom kiri diubah menjadi urutan berikut:
1. `Untuk siapa voucher ini?`
2. `Cara kirim voucher`
3. `Data pembeli`
4. `Metode pembayaran`
- Kolom kanan tetap `Ringkasan Pesanan`, sticky di desktop.
- Tambahkan intro singkat di bawah judul halaman: `Isi data penerima, pilih cara kirim, lalu lanjut ke pembayaran.`

### Section 1: Untuk Siapa Voucher Ini
- Field yang tampil selalu:
  - `Nama Penerima`
  - `Pesan untuk Penerima` (opsional)
  - toggle `Kirim Voucher Ke`: `Langsung ke Penerima` dan `Kirim ke Saya`
- Tambahkan helper text di bawah `Nama Penerima`: `Nama ini akan tercetak di voucher.`
- `Nama Penerima` tetap wajib untuk semua mode.
- `recipientPhone` dan `recipientEmail` dipindahkan keluar dari section ini.

### Section 2: Cara Kirim Voucher
- Tampilkan pilihan `WhatsApp`, `Email`, `Email & WhatsApp`.
- Di bawah pilihan, selalu tampil `delivery preview` real-time:
  - `RECIPIENT + WHATSAPP`: `Voucher akan dikirim ke WhatsApp penerima setelah pembayaran berhasil.`
  - `RECIPIENT + EMAIL`: `Voucher akan dikirim ke email penerima setelah pembayaran berhasil.`
  - `RECIPIENT + BOTH`: `Voucher akan dikirim ke email dan WhatsApp penerima setelah pembayaran berhasil.`
  - `PURCHASER + WHATSAPP`: `Voucher akan dikirim ke WhatsApp kamu setelah pembayaran berhasil.`
  - `PURCHASER + EMAIL`: `Voucher akan dikirim ke email kamu setelah pembayaran berhasil.`
  - `PURCHASER + BOTH`: `Voucher akan dikirim ke email dan WhatsApp kamu setelah pembayaran berhasil.`
- Field kontak tampil kondisional berdasarkan kombinasi state:
  - `sendTo === RECIPIENT` dan `deliveryMethod === WHATSAPP`: tampil hanya `WhatsApp Penerima`
  - `sendTo === RECIPIENT` dan `deliveryMethod === EMAIL`: tampil hanya `Email Penerima`
  - `sendTo === RECIPIENT` dan `deliveryMethod === BOTH`: tampil `WhatsApp Penerima` dan `Email Penerima`
  - `sendTo === PURCHASER`: jangan tampilkan field kontak penerima sama sekali
- Saat `sendTo === PURCHASER`, tampil info box kecil: `Voucher tetap memakai nama penerima di voucher, tetapi pengiriman akan dikirim ke kontak kamu.`

### Section 3: Data Pembeli
- Tetap berisi:
  - `Nama Lengkap`
  - `Email`
  - `WhatsApp`
- Tambahkan helper copy singkat: `Kami gunakan untuk konfirmasi pembayaran dan bantuan jika ada kendala.`

### Section 4: Metode Pembayaran
- Pertahankan source data dari `paymentConfig.paymentOptions`.
- Tambahkan deskripsi per metode berdasarkan `option.code`:
  - `qris`: `Bayar dengan scan QRIS. Kode QR akan ditampilkan setelah pesanan dibuat.`
  - `va`: `Dapatkan nomor virtual account. Pilih bank setelah memilih metode ini.`
  - `invoice`: `Lanjut ke halaman pembayaran untuk menyelesaikan transaksi.`
  - e-wallet (`gopay`, `ovo`, `dana`, `shopeepay`, `linkaja`): `Kamu akan diarahkan ke halaman pembayaran / instruksi wallet.`
  - fallback: `Pembayaran diproses melalui Scalev.`
- Dropdown bank untuk `va` tetap di bawah radio/card metode pembayaran.

### Summary dan CTA
- Desktop:
  - summary card tetap sticky
  - tombol submit tetap berada di summary card
- Mobile:
  - tambah sticky bottom bar berisi `Total` dan tombol `Lanjut ke Pembayaran`
  - tombol submit di summary card disembunyikan pada mobile agar tidak dobel
  - halaman diberi bottom padding agar konten tidak ketutup sticky bar
- Tambahkan stepper text kecil di summary: `1. Isi data  2. Bayar  3. Voucher dikirim`

## Behavior dan State Checkout
### Loading State Awal
- Hapus full-screen spinner saat `paymentConfig` belum tersedia.
- Render shell halaman penuh sejak awal:
  - judul dan summary tetap tampil
  - section pembayaran menampilkan skeleton/loading card dengan copy `Sedang menyiapkan metode pembayaran...`
- Jika fetch payment options gagal, tampilkan inline error state di card pembayaran plus tombol `Coba Muat Ulang`, bukan hanya toast.

### Validasi Form
- `customerName`, `customerEmail`, `customerPhone`, `recipientName`, `sendTo`, `deliveryMethod` tetap wajib.
- `recipientPhone` hanya wajib jika `sendTo === RECIPIENT` dan delivery mencakup WhatsApp.
- `recipientEmail` hanya wajib jika `sendTo === RECIPIENT` dan delivery mencakup Email.
- Error message pertama tetap difokuskan via `setFocus`.
- Pertahankan ARIA/live-region yang sudah ada; update announcement agar sesuai field kondisional baru.

### Format Nomor Telepon
- Tambahkan normalisasi input ringan di client untuk menoleransi spasi/dash.
- Copy helper tetap eksplisit: `Gunakan format 08xxxxxxxx atau +62xxxxxxxx`.
- Backend tetap menormalisasi ke format Scalev seperti sekarang.

## Handoff ke Pembayaran
- Jangan lagi membuka blank popup kosong.
- Tetap buka window sinkron saat submit untuk menghindari popup blocker, tetapi isi window tersebut langsung dengan HTML loading shell sederhana bertema Kalanara:
  - judul `Menyiapkan halaman pembayaran...`
  - body `Jangan tutup tab ini. Kami sedang mengarahkan kamu ke pembayaran.`
  - fallback copy `Jika tidak terbuka otomatis, kembali ke halaman status pembayaran.`
- Setelah API sukses:
  - jika `paymentLink` adalah hosted external page, arahkan popup itu ke `paymentLink`
  - jika `paymentLink` adalah public-order URL / flow internal, tutup popup
  - setelah itu tetap `router.push` ke `/checkout/success?order_id=...&token=...`
- Jika API gagal, tutup popup shell dan tampilkan toast error.

## Perubahan Logic Backend
### Type dan Kontrak Request
- Di [types.ts](D:/Projects/Vibe%20Code/kalanaraspa/lib/scalev/types.ts):
  - ubah `ScalevCheckoutRequest.recipientPhone` menjadi opsional
  - pertahankan `recipientEmail` opsional
  - ubah `ScalevPendingOrderData.recipient_phone` menjadi opsional
- Tidak ada perubahan nama field API.
- Tidak ada perubahan endpoint publik.

### Validasi `/api/scalev/create-payment`
- `validateRequest` di [create-payment/route.ts](D:/Projects/Vibe%20Code/kalanaraspa/app/api/scalev/create-payment/route.ts) diubah menjadi rule kondisional:
  - `recipientName` tetap required
  - `recipientPhone` required hanya bila `sendTo === RECIPIENT` dan delivery mencakup WhatsApp
  - `recipientEmail` required hanya bila `sendTo === RECIPIENT` dan delivery mencakup Email
- Saat field opsional tidak relevan, simpan `undefined`/`null`, jangan paksa string kosong.
- `createPendingOrder` harus mengisi `recipient_phone: data.recipient_phone || null`.

### Voucher Creation dan Delivery
- Update [voucher-service.ts](D:/Projects/Vibe%20Code/kalanaraspa/lib/payment/voucher-service.ts) agar validasi kontak memakai `effective delivery target`, bukan raw `recipient_*`.
- Rule final:
  - jika `send_to === RECIPIENT`, gunakan `recipient_email`/`recipient_phone`
  - jika `send_to === PURCHASER`, gunakan `customer_email`/`customer_phone`
- Guard sebelum create/deliver:
  - untuk delivery email, pastikan effective email ada
  - untuk delivery WhatsApp, pastikan effective phone ada
  - untuk `BOTH`, keduanya harus tersedia pada target yang aktif
- Voucher metadata tetap memakai `recipient_name` untuk nama di voucher.
- Tidak perlu migration database karena `recipient_email` dan `recipient_phone` sudah nullable di generated types.

## Spesifikasi Halaman Pending/Success
### Pending State
- Pisahkan copy untuk `pending` vs `error`.
- Jika `payload.status === pending`:
  - title: `Lanjutkan Pembayaran`
  - subtitle: `Pesanan berhasil dibuat. Selesaikan pembayaran untuk mengaktifkan voucher.`
- Jika `paymentInstructions.kind === qris`, tampilkan QR card seperti sekarang dengan CTA utama `Saya Sudah Bayar` yang memicu refresh/poll ulang.
- Jika `paymentLink` ada dan bukan public-order URL, tampilkan CTA utama `Buka Halaman Pembayaran`.
- Tombol secondary tetap `Coba Lagi` atau `Cek Status Lagi`, bukan copy generik.
- Jika polling timeout/error:
  - title: `Pembayaran Masih Dicek`
  - subtitle: `Kami belum menerima konfirmasi terbaru. Cek lagi beberapa saat lagi.`

### Completed State
- Tambahkan ringkasan delivery destination dengan memanfaatkan `voucher.deliveryMethod` dan `voucher.sendTo` dari payload:
  - contoh: `Voucher dikirim ke WhatsApp kamu`
  - contoh: `Voucher dikirim ke email dan WhatsApp penerima`
- Ubah area resend menjadi lebih jelas:
  - judul: `Butuh kirim ulang?`
  - copy kecil: `Gunakan tombol di bawah untuk mengirim ulang voucher ke tujuan pengiriman yang aktif.`
- Tombol resend email tetap disabled jika target email memang tidak ada, tetapi copy harus menjelaskan alasannya.

## File yang Harus Diubah
- [checkout-page-client.tsx](D:/Projects/Vibe%20Code/kalanaraspa/app/checkout/[id]/checkout-page-client.tsx)
- [types.ts](D:/Projects/Vibe%20Code/kalanaraspa/lib/scalev/types.ts)
- [create-payment/route.ts](D:/Projects/Vibe%20Code/kalanaraspa/app/api/scalev/create-payment/route.ts)
- [orders.ts](D:/Projects/Vibe%20Code/kalanaraspa/lib/actions/orders.ts)
- [voucher-service.ts](D:/Projects/Vibe%20Code/kalanaraspa/lib/payment/voucher-service.ts)
- [success/page.tsx](D:/Projects/Vibe%20Code/kalanaraspa/app/checkout/success/page.tsx)
- [checkout-page-client.test.tsx](D:/Projects/Vibe%20Code/kalanaraspa/app/checkout/[id]/checkout-page-client.test.tsx)
- Tambah test baru untuk route/service jika belum ada coverage memadai

## Test Cases dan Skenario
- Checkout render shell tanpa full-screen spinner ketika payment config masih loading.
- `sendTo=RECIPIENT + WHATSAPP` hanya menampilkan `recipientPhone`.
- `sendTo=RECIPIENT + EMAIL` hanya menampilkan `recipientEmail`.
- `sendTo=RECIPIENT + BOTH` menampilkan keduanya.
- `sendTo=PURCHASER` menyembunyikan semua kontak penerima dan menampilkan delivery preview ke pembeli.
- Submit sukses pada `sendTo=PURCHASER + WHATSAPP` tanpa mengisi `recipientPhone`.
- Submit sukses pada `sendTo=PURCHASER + EMAIL` tanpa mengisi `recipientEmail`.
- Validasi API menolak request yang tidak punya effective contact sesuai channel.
- `createPendingOrder` menyimpan `recipient_phone` sebagai `null` saat tidak relevan.
- `voucher-service` tidak gagal membuat voucher bila raw recipient contact kosong tetapi effective contact pembeli tersedia.
- Pending page QRIS menampilkan QR + nominal + expiry + CTA refresh.
- Pending page hosted payment menampilkan CTA `Buka Halaman Pembayaran`.
- Completed page menampilkan delivery summary yang benar berdasarkan `sendTo` dan `deliveryMethod`.
- Existing regression test untuk public order URL tetap lolos.
- Existing accessibility behavior tetap aman untuk field kondisional.

## Acceptance Criteria
- User bisa checkout mode `Kirim ke Saya` tanpa dipaksa mengisi kontak penerima.
- Tidak ada blank popup saat submit.
- Mobile selalu punya CTA submit yang visible.
- Copy halaman pending/success menjelaskan langkah berikutnya tanpa ambigu.
- `bunx tsc --noEmit` harus lolos.
- `bun run lint` harus lolos tanpa error.
- Test checkout yang relevan harus lolos.

## Asumsi dan Default yang Dipilih
- Tidak ada migration database; schema orders saat ini sudah cukup karena kolom recipient contact nullable.
- Default state tetap `sendTo = RECIPIENT` dan `deliveryMethod = WHATSAPP`.
- `recipientName` tetap required karena nama ini adalah identitas voucher, walaupun pengiriman diarahkan ke pembeli.
- Flow tetap satu halaman checkout dan satu halaman status/success; tidak membuat route baru.
- Endpoint publik tetap sama; perubahan hanya pada rule validasi dan UX.
