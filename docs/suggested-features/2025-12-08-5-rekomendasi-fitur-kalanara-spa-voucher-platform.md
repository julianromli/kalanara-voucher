# 5 Rekomendasi Fitur untuk Kalanara Spa Voucher Platform
**Per 8 Desember 2025** | Berdasarkan riset kompetitor & tren industri gift card/spa 2024-2025

---

## Fitur Saat Ini
- Katalog voucher publik
- Checkout dengan delivery WhatsApp/Email
- Admin dashboard
- QR redemption untuk verifikasi

---

## Rekomendasi Fitur Baru

### 1. 🏆 Program Loyalti Bertingkat (Tiered Loyalty)
**Deskripsi:** Sistem membership dengan tier Silver, Gold, Platinum berdasarkan akumulasi pembelian.

**Fitur Utama:**
- Poin per pembelian (misal: Rp 10.000 = 1 poin)
- Tier otomatis naik berdasarkan total spending
- Diskon eksklusif per tier (5%, 10%, 15%)
- Birthday rewards & early access ke voucher baru

**RICE Score:**
| Metric | Value | Notes |
|--------|-------|-------|
| Reach | 1000 user/bulan | Returning customers |
| Impact | 3/3 (High) | Retention naik 25-40% (Zenoti 2025) |
| Confidence | 80% | Terbukti di industri spa |
| Effort | 4 minggu | Database + UI + logic |
| **Score** | **60** | (1000×3×0.8)/40 |

---

### 2. 📱 WhatsApp Commerce Chatbot
**Deskripsi:** Integrasi WhatsApp Business API untuk pembelian voucher langsung via chat.

**Fitur Utama:**
- Katalog produk dalam WhatsApp (Meta Catalog)
- Add to cart & checkout dalam chat
- Notifikasi status pesanan otomatis
- Customer support chatbot 24/7

**Relevansi Indonesia:** 
- 69% bisnis Indonesia belum adopsi AI/conversational commerce (SurveySensum 2024)
- WhatsApp adalah platform messaging #1 di Indonesia
- E-commerce Indonesia proyeksi $90.47B tahun 2026 (Statista)

**RICE Score:**
| Metric | Value | Notes |
|--------|-------|-------|
| Reach | 2000 user/bulan | Mobile-first market |
| Impact | 3/3 (High) | Conversion rate naik 30-50% |
| Confidence | 85% | Best practice Indonesia |
| Effort | 6 minggu | WhatsApp API + chatbot flow |
| **Score** | **85** | (2000×3×0.85)/60 |

---

### 3. 🎁 Paket Experience / Bundle Voucher
**Deskripsi:** Voucher paket yang menggabungkan beberapa layanan dengan harga spesial.

**Fitur Utama:**
- Bundle creator di admin (kombinasi layanan)
- Diskon otomatis untuk paket
- "Gift-ready" packaging dengan pesan personal
- Expiry date lebih panjang untuk paket premium

**Contoh Paket:**
- "Relaxation Package": Massage + Facial + Aromatherapy
- "Couple Retreat": 2x Massage + Spa Bath
- "Birthday Glow": Facial + Manicure + Complimentary Drink

**RICE Score:**
| Metric | Value | Notes |
|--------|-------|-------|
| Reach | 800 user/bulan | Gift buyers |
| Impact | 2/3 (Medium) | AOV naik 40-60% |
| Confidence | 90% | Fitur standar kompetitor |
| Effort | 2 minggu | Database + UI sederhana |
| **Score** | **72** | (800×2×0.9)/20 |

---

### 4. 🤖 Smart Voucher Recommendations (AI-Powered)
**Deskripsi:** Rekomendasi voucher personal berdasarkan perilaku user dan konteks (occasion, budget).

**Fitur Utama:**
- "Populer minggu ini" berdasarkan sales data
- Rekomendasi berdasarkan occasion (birthday, anniversary, thank you)
- Budget-based suggestions
- "Customers also bought" section

**Implementasi Awal (Non-ML):**
- Rule-based recommendations dari Supabase
- Occasion tagging pada produk
- Trending berdasarkan recent orders

**RICE Score:**
| Metric | Value | Notes |
|--------|-------|-------|
| Reach | 1500 user/bulan | All visitors |
| Impact | 2/3 (Medium) | Conversion +15-25% |
| Confidence | 70% | Simplified version |
| Effort | 3 minggu | Query logic + UI |
| **Score** | **70** | (1500×2×0.7)/30 |

---

### 5. 📅 Booking Appointment Integration
**Deskripsi:** Pemegang voucher bisa langsung booking jadwal treatment setelah pembelian.

**Fitur Utama:**
- Calendar view untuk available slots
- Booking langsung dari halaman voucher
- Reminder otomatis via WhatsApp/Email (H-1, H-3)
- Reschedule & cancel dengan mudah

**User Flow:**
1. Beli voucher → Terima voucher PDF + booking link
2. Klik booking link → Pilih tanggal & waktu
3. Konfirmasi via WhatsApp → Reminder otomatis

**RICE Score:**
| Metric | Value | Notes |
|--------|-------|-------|
| Reach | 600 user/bulan | Voucher holders |
| Impact | 3/3 (High) | Redemption rate naik 50% |
| Confidence | 75% | Kompleksitas medium |
| Effort | 5 minggu | Calendar + notification system |
| **Score** | **54** | (600×3×0.75)/50 |

---

## Prioritas Implementasi (berdasarkan RICE Score)

| Priority | Fitur | RICE Score | Effort | Quick Win? |
|----------|-------|------------|--------|------------|
| 1 | WhatsApp Commerce Chatbot | 85 | 6 minggu | ❌ |
| 2 | Paket Experience/Bundle | 72 | 2 minggu | ✅ |
| 3 | Smart Recommendations | 70 | 3 minggu | ✅ |
| 4 | Program Loyalti Bertingkat | 60 | 4 minggu | ❌ |
| 5 | Booking Integration | 54 | 5 minggu | ❌ |

---

## Rekomendasi Roadmap Q1 2026

**Minggu 1-2:** Paket Experience/Bundle (Quick Win)  
**Minggu 3-5:** Smart Recommendations  
**Minggu 6-11:** WhatsApp Commerce Chatbot  
**Minggu 12-15:** Program Loyalti Bertingkat  
**Q2 2026:** Booking Integration (scope besar)

---

## Sumber Riset
- Zenoti: "Digital loyalty programs drive retention for beauty and wellness brands in 2025"
- VaocherApp/VoucherCart: Fitur spa gift voucher software
- Gupshup/Mekari Qontak: WhatsApp Business API Indonesia
- Enjovia: "Gift Card Trends Shaping 2025"
- SurveySensum: "CX Indonesia 2024" (69% bisnis belum adopsi AI)
- SimpleLoyalty: "5 Creative Loyalty Program Ideas for Spas 2025"