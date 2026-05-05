# Revisi struktur landing page — section narasi «Me Time» & gift voucher

Dokumen ini merencanakan penambahan blok konten bersifat **emisional/edukatif** (selaras narasi dari halaman kampanye eksternal *flash sale* — “Kamu pasti relate”, persona hadiah, jembatan ke **gift voucher**) tanpa mengubah file kode sampai tim setuju untuk implementasi.

**Referensi isi narasi:** ringkasan scrape `kalanaraspa.com/flash-sale` (bahasa Indonesia).

---

## 1. Baseline — struktur saat ini (`app/page.tsx`)


| Urutan | Section              | Komponen / catatan                                  |
| ------ | -------------------- | --------------------------------------------------- |
| 1      | Hero (full viewport) | Headline *Me Time*, CTA `#services`, link `/verify` |
| 2      | Katalog paket        | `ServicesSection` → anchor `#services`              |
| 3      | Testimoni            | `TestimonialsSection` (data DB)                     |
| 4      | Kepercayaan / fitur  | `TrustFeatures`                                     |
| 5      | Footer               | `Footer13`                                          |


---

## 2. Struktur landing page setelah revisi (usulan)


| Urutan | Section                             | Perubahan                                                                                                            |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1      | **Hero**                            | Tetap — opsional penyelarasan *microcopy* agar tidak redundan dengan section baru                                    |
| 2      | **Me Time relate & persona hadiah** | **BARU** — narasi + 4 persona + jembatan ke voucher                                                                  |
| 3      | **Pilar “kenapa voucher”**          | **BARU (opsional, ringkas)** — 1 paragraf + 3 bullet (bisa digabung ke dalam section 2 jika ingin satu blok panjang) |
| 4      | **Katalog paket**                   | `ServicesSection` — tetap anchor `#services`                                                                         |
| 5      | **Testimoni**                       | `TestimonialsSection`                                                                                                |
| 6      | **Trust / fitur**                   | `TrustFeatures`                                                                                                      |
| 7      | **Footer**                          | `Footer13`                                                                                                           |


**Penempatan disarankan:** tepat **setelah Hero** dan **sebelum** `ServicesSection`, supaya pengunjung memahami *mengapa* voucher relevan sebelum melihat harga/paket.

---

## 3. Spesifikasi section baru: «Kalanara — Me Time Section» (nama kerja)

### 3.1 Tujuan

- Membangun empati (*relate*) lalu mengarahkan ke **pembelian voucher sebagai hadiah** (atau untuk diri sendiri).
- Menjaga nada hangat, personal, bahasa Indonesia seperti referensi kampanye.

### 3.2 Struktur internal (alur konten)

1. **Eyebrow / label**
  Contoh: `Kamu pasti relate` atau `Kalanara Me Time`.
2. **Headline utama**
  Mengajak merenung: mis. *“Kapan terakhir kali dia benar-benar me-time?”* (varian untuk “dia” bisa diganti “kalian” atau netral sesuuti keputusan editorial).
3. **Lead paragraph**
  Mengakui kelelahan orang terkasih / keragu-raguan memilih hadiah bermakna (paragraf singkat seperti di referensi scrape).
4. **Grid persona (4 kartu)** — setiap kartu minimal:
  - **Emoji / ikon** (opsional, konsisten dengan desain sistem)
  - **Kutipan internal** atau label situasi *(bukan testimoni pelanggan sungguhan kecuali punya izin/data)*
  - Contoh tema dari referensi:
    - **Mama** — kerja keras, beri waktu untuk dirinya
    - **Pasangan** — hadiah berbeda dari rutinitas, supportive partner
    - **Sahabat** — ultah/deadline yang personal & memorable
    - **Diri sendiri** — me-time sebagai kebutuhan, bukan kemewahan
5. **Jembatan nilai**
  Kalimat penyatuan: *Semua orang butuh waktu benar-benar istirahat*; **hadiah terbaik = waktu** + ketenangan; *“Biar kami yang urus sisanya”* (atau formulasi yang selaras tone brand voucher platform).
6. **CTA ke katalog**
  Tombol/link ke `**#services`** (selaras hero) atau langsung scroll ke kartu pertama layanan — teks mis. *Lihat paket voucher* atau *Pilih paket sekarang*.

### 3.3 Hal teknis / UX yang perlu dicatat untuk implementasi nanti

- **ID section:** mis. `id="me-time-gift"` agar bisa ditaut dari navbar sekunder atau CTA kedua di hero (opsional).
- **Reduced motion:** animasi stagger mengikuti `globals.css` / `prefers-reduced-motion` seperti section lain.
- **Relasi dengan Hero:** hero sudah menyebut *Me Time*; section baru bisa fokus ke **kisah persona**, bukan mengulang headline yang sama verbatim.
- **Integritas klaim:** jika ada angka seperti *500+*, hanya pakai jika punya dasar data; kalau tidak, ganti dengan formulasi tanpa statistik keras.

---

## 4. Opsi struktur minimal (tanpa subsection terpisah)

Jika ingin **satu section** saja tanpa “Pilar kenapa voucher” terpisah:

- Hero → **Me Time (persona + CTA `#services`)** → ServicesSection → testimoni → trust → footer.

---

## 5. Pemetaan file / komponen (untuk sprint implementasi — belum dilakukan)


| Usulan                                                        | Keterangan                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `components/me-time-gift-section.tsx` (nama bisa disesuaikan) | Server Component default; pakai `SiteContainer`, pola animasi sama dengan landing |
| Impor di `app/page.tsx`                                       | Setelah blok Hero, sebelum `<ServicesSection />`                                  |


---

## 6. Checklist sebelum go-live konten baru

- Copy sudah diverifikasi brand voice & ejaan ID  
- Persona tidak membingungkan dengan testimoni nyata (`TestimonialsSection`)  
- CTA jelas mengarah ke katalog `#services` (atau flow checkout yang disepakati)  
- Lighthouse / a11y: heading hierarchy tidak loncat dari `h1` hero ke `h3` di section baru tanpa `h2`

---

*Versi dokumen: 2026-05-04 · Konteks codebase: landing `app/page.tsx`.*