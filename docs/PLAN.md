# Implementasi Migrasi Payment Gateway ke Scalev

## Ringkasan
Implementasi mengganti seluruh flow pembayaran aktif dari Mayar ke Scalev, tetapi **voucher lifecycle tetap lokal di Supabase**. `services` tetap menjadi source of truth produk, lalu disinkronkan ke product/variant digital di store Scalev `Kalanara Spa` (`store_uFfyn8rkIwuwWbHAKVYeRjOi`). Runtime app akan memakai env server untuk memanggil Scalev langsung. v1 memakai **polling + reconciliation server-side**, bukan webhook.

Skill yang dipakai:
- `vercel-react-best-practices`: kurangi waterfall di route handler, minimalkan data ke client, polling lewat endpoint server kecil.
- `supabase-postgres-best-practices` tidak tersedia di sesi ini, jadi keputusan schema/migrasi memakai prinsip additive migration dari dokumentasi resmi Supabase: additive columns, indexed lookup fields, tanpa memutus historical data.

## Perubahan Backend
- Tambahkan modul `lib/scalev/` dengan 3 bagian:
  - `config.ts`: baca env server untuk auth Scalev, `store_unique_id`, daftar metode bayar yang diizinkan.
  - `types.ts`: type request/response internal app, type status Scalev, type mapping payment method/sub-method.
  - `client.ts`: wrapper server-side untuk operasi Scalev yang dipakai runtime:
    - list/create/update product digital
    - list/create/update variant
    - add product ke store bila belum terhubung
    - create order
    - create payment untuk order
    - check payment status / settlement status order
- Ganti route payment aktif:
  - Nonaktifkan flow Mayar dari jalur checkout aktif.
  - Tambahkan route baru `POST /api/scalev/create-payment`.
  - Route ini melakukan langkah berurutan:
    1. validasi body checkout,
    2. load `service` aktif dari Supabase,
    3. resolve mapping `service -> Scalev variant`,
    4. buat pending order lokal,
    5. create order di Scalev,
    6. create payment request Scalev,
    7. simpan seluruh identifier eksternal ke order lokal,
    8. return `paymentLink`, `paymentOrderId`, dan ringkasan metode bayar.
- Tambahkan route reconcile baru untuk success page, misalnya `GET /api/orders/public-status?order_id=...`.
  - Route ini lookup order lokal by `payment_order_id`.
  - Jika order sudah `COMPLETED` dan voucher sudah ada, return final payload.
  - Jika masih `PENDING`, route memanggil Scalev untuk refresh status, update order lokal, dan jika payment efektif paid/settled maka:
    - isi field payment lokal,
    - panggil `createVoucherOnPaymentSuccess`,
    - return payload final.
  - Route ini harus idempotent: boleh dipanggil berkali-kali tanpa membuat voucher ganda.
- Pertahankan `lib/payment/voucher-service.ts` sebagai satu-satunya tempat pembuatan voucher lokal dan pengiriman email/WhatsApp.
- Update `lib/actions/orders.ts`:
  - tambahkan create/update/get helper untuk field Scalev,
  - pisahkan update manual admin (`updateOrderStatus`) dari update hasil gateway (`updateOrderPaymentStatus`),
  - tambahkan helper `getOrderByPaymentOrderId`, `getOrderByScalevOrderPk`, `getOrderByScalevPgReferenceId`,
  - tambahkan helper `markOrderFailedFromGateway`.
- Jangan hapus historical compatibility:
  - data order lama Mayar tetap terbaca,
  - hanya order baru yang ditandai `payment_provider = 'scalev'`.

## Perubahan Supabase
- Buat migration baru additive, tidak mengubah/rename field lama yang sudah dipakai:
  - pada `public.services` tambahkan:
    - `scalev_product_id bigint null`
    - `scalev_variant_id bigint null`
    - `scalev_variant_unique_id text null`
    - `scalev_sync_status text null`
    - `scalev_last_synced_at timestamptz null`
  - pada `public.orders` tambahkan:
    - `payment_provider text not null default 'scalev'` untuk row baru; historical row lama boleh tetap di-backfill ke `'mayar'` jika dibutuhkan, tetapi tidak wajib untuk v1
    - `scalev_order_pk bigint null`
    - `scalev_order_id text null`
    - `scalev_pg_reference_id text null`
    - `scalev_payment_method text null`
    - `scalev_sub_payment_method text null`
    - `scalev_store_unique_id text null`
    - `scalev_last_checked_at timestamptz null`
    - `scalev_raw_status text null`
    - `scalev_raw_payment_status text null`
  - pertahankan field generic existing:
    - `payment_order_id` = internal KSP order id
    - `payment_transaction_id` = payment reference final yang dipakai untuk lookup operasional
    - `payment_type` = metode bayar final
    - `payment_link` = invoice/payment URL
- Tambahkan index:
  - `services(scalev_variant_unique_id)` partial non-null
  - `orders(payment_provider, payment_order_id)`
  - `orders(scalev_order_pk)` partial non-null
  - `orders(scalev_pg_reference_id)` partial non-null
  - `orders(payment_transaction_id)` jika belum cukup untuk lookup final
- Update `lib/database.types.ts` agar mencerminkan kolom baru.
- Lakukan pemeriksaan RLS setelah migrasi:
  - route payment/reconcile tetap memakai admin/service-role path seperti flow sekarang,
  - tidak ada kebutuhan policy baru untuk client browser.

## Sinkronisasi Catalog & Checkout UI
- Catalog strategy dipatok 1:1:
  - setiap `service` aktif di Supabase menjadi **1 product digital** di Scalev,
  - product memiliki **1 variant utama** dengan nama, harga, dan metadata service lokal,
  - `scalev_variant_unique_id` disimpan di `services`.
- Buat util/server task sinkronisasi:
  - source data hanya `services.is_active = true`,
  - jika mapping belum ada: create product + variant + attach ke store,
  - jika mapping ada: update nama/harga bila berbeda,
  - service nonaktif tidak ditampilkan di checkout app; tidak perlu delete dari Scalev pada v1, cukup tandai sync status lokal.
- Ubah checkout page:
  - import type dari `lib/scalev/types`, bukan `lib/mayar/types`,
  - tampilkan pilihan metode pembayaran Scalev:
    - `qris`
    - `invoice`
    - `va` + pilihan bank
    - `gopay`, `ovo`, `dana`, `shopeepay`, `linkaja`
  - pilihan yang dirender harus berasal dari config server yang sesuai dengan store Scalev yang sudah diaktifkan.
  - submit ke route baru dan redirect ke `paymentLink`.
- Ubah success page:
  - jangan panggil server action langsung dari client untuk lookup order.
  - polling endpoint publik kecil yang return status ter-normalisasi.
  - state client hanya memegang `loading | pending | completed | failed` dan payload voucher minimal.
  - jika `pending` setelah batas polling, tampilkan pesan verifikasi tertunda dan tombol retry manual.
- Admin purchases tetap memakai data `orders` lokal, tetapi UI perlu menampilkan:
  - provider (`scalev` / historical `mayar`)
  - payment method final
  - external order/reference id Scalev bila ada

## Mapping Status & Metode Bayar
- Metode bayar lokal ke Scalev:
  - `qris` -> `payment_method='qris'`
  - `invoice` -> `payment_method='invoice'`
  - virtual account -> `payment_method='va'`, `sub_payment_method` bank code
  - e-wallet -> `payment_method` sesuai kode Scalev
- Mapping status Scalev ke lokal:
  - unpaid / pending / created -> `PENDING`
  - paid / settled / completed -> `COMPLETED`
  - canceled / expired / closed -> `FAILED`
  - refund/refunded -> `REFUNDED`
  - conflict -> simpan raw status, tetap `PENDING` sampai ada keputusan eksplisit
- `payment_transaction_id` diisi dengan prioritas:
  1. `scalev_pg_reference_id` bila tersedia,
  2. fallback ke identifier pembayaran Scalev lain yang stabil,
  3. jangan pakai `scalev_order_pk` jika reference pembayaran yang lebih tepat tersedia.
- `payment_method` enum lokal lama tidak diubah pada v1; field ini tetap diisi coarse-grained:
  - `BANK_TRANSFER` untuk `va` dan `invoice`
  - `E_WALLET` untuk qris/e-wallet
  - `CREDIT_CARD` tidak dipakai kecuali store benar-benar mengaktifkannya nanti

## Test Plan
- Migration tests:
  - migration additive jalan bersih di Supabase,
  - historical order lama tetap queryable,
  - kolom baru nullable sesuai kebutuhan bootstrap.
- Unit tests:
  - validasi request create-payment Scalev,
  - mapping service ke payload Scalev,
  - mapping status/metode bayar Scalev ke model lokal,
  - idempotency reconcile saat dipanggil berulang.
- Integration tests:
  - create pending order lokal -> create order Scalev -> create payment -> return redirect link,
  - success page polling ketika masih pending,
  - reconcile mengubah order jadi `COMPLETED` dan membuat voucher tepat sekali,
  - resend email/WhatsApp tetap berfungsi setelah order provider `scalev`.
- Manual scenarios:
  - tiap metode bayar aktif bisa dipilih dan redirect,
  - order paid menghasilkan voucher + QR + verify flow normal,
  - order gagal/expired tidak membuat voucher,
  - admin purchases page tetap tampil tanpa regression.
- Acceptance criteria:
  - jalur aktif checkout tidak lagi bergantung pada `app/api/mayar/*` atau `lib/mayar/*`,
  - store Scalev Kalanara siap menerima metode bayar yang ditampilkan UI,
  - dashboard/review/redeem flow lokal tidak berubah perilakunya.

## Asumsi
- Implementasi dilakukan setelah mode sesi keluar dari `Plan Mode`; saat ini rencana ini adalah spesifikasi final, bukan eksekusi.
- Runtime app akan diberi env server Scalev yang valid.
- Store target tetap `Kalanara Spa` dengan `unique_id = store_uFfyn8rkIwuwWbHAKVYeRjOi`.
- Produk voucher di Scalev dipakai hanya untuk payment/order orchestration; voucher akhir tetap lokal.
- v1 tidak mengandalkan webhook Scalev.
