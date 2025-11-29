   Product Requirements Document (PRD)

   Kalanara Spa - Voucher Booking Platform

   ──────────────────────────────────────────

   1. Executive Summary

   Product Name: Kalanara Spa
   Type: Organic Luxury Spa Voucher Booking Platform with Admin Management System
   Target Market: Indonesia (Bahasa Indonesia currency: IDR)
   Tech Stack: React 19 + Vite + TypeScript + TailwindCSS + LocalStorage

   Vision Statement

   Membangun platform voucher spa premium yang memungkinkan pelanggan membeli, mengirim sebagai hadiah,
   dan menggunakan voucher spa secara digital dengan sistem manajemen admin yang lengkap.

   ──────────────────────────────────────────

   2. Problem Statement

   Masalah yang Dipecahkan:
   1. Proses Pembelian Manual - Banyak spa masih mengandalkan pembelian voucher secara langsung/telepon
   2. Kesulitan Gift Giving - Tidak ada cara mudah untuk mengirim voucher spa sebagai hadiah digital
   3. Pengelolaan Voucher - Admin kesulitan melacak voucher yang aktif, terpakai, dan kadaluarsa
   4. Verifikasi Voucher - Risiko penipuan karena tidak ada sistem verifikasi digital
   5. Tidak Ada Analytics - Kurangnya insight tentang performa penjualan dan service populer

   ──────────────────────────────────────────

   3. User Personas

   Persona 1: Customer (Pembeli)
   •  Siapa: Wanita/Pria urban, 25-45 tahun
   •  Kebutuhan: Membeli voucher spa untuk diri sendiri atau sebagai hadiah
   •  Pain Points: Proses pembelian yang rumit, tidak bisa mengirim voucher digital

   Persona 2: Gift Sender
   •  Siapa: Orang yang ingin memberikan voucher spa sebagai hadiah
   •  Kebutuhan: Mengirim voucher dengan pesan personal ke penerima
   •  Pain Points: Harus menyerahkan voucher fisik, tidak ada opsi delivery digital

   Persona 3: Staff Spa
   •  Siapa: Resepsionis/staff operasional
   •  Kebutuhan: Redeem voucher dengan cepat, cek validitas voucher
   •  Pain Points: Proses manual yang lambat, risiko voucher palsu

   Persona 4: Admin/Owner
   •  Siapa: Pemilik/manajer spa
   •  Kebutuhan: Melihat analytics, kelola service, audit trail
   •  Pain Points: Tidak ada dashboard terpusat untuk mengelola bisnis

   ──────────────────────────────────────────

   4. Features & User Stories

   4.1 Public Features (Customer-Facing)

   A. Landing Page

   User Story                                      │ Priority
   ------------------------------------------------+------------
   Sebagai customer, saya ingin melihat hero       │ Must Have
   section yang menarik agar tertarik dengan       │
   Kalanara Spa                                    │
   Sebagai customer, saya ingin melihat katalog    │ Must Have
   service/treatment yang tersedia                 │
   Sebagai customer, saya ingin membaca            │ Should Have
   testimonial pelanggan lain                      │
   Sebagai customer, saya ingin melihat trust      │ Should Have
   indicators (instant delivery, validity period,  │
   secure payment)                                 │

   B. Voucher Detail Page

   User Story                                      │ Priority
   ------------------------------------------------+----------
   Sebagai customer, saya ingin melihat detail     │ Must Have
   service (durasi, harga, facilities) sebelum     │
   membeli                                         │
   Sebagai customer, saya ingin melihat gambar     │ Must Have
   service yang akan saya beli                     │

   C. Checkout Flow

   User Story                                      │ Priority
   ------------------------------------------------+------------
   Sebagai customer, saya ingin mengisi data       │ Must Have
   purchaser (nama, email, WhatsApp)               │
   Sebagai customer, saya ingin memilih apakah     │ Must Have
   voucher ini sebagai hadiah atau untuk diri      │
   sendiri                                         │
   Sebagai customer, saya ingin menulis pesan      │ Must Have
   personal untuk penerima hadiah                  │
   Sebagai customer, saya ingin memilih apakah     │ Should Have
   voucher dikirim ke saya atau langsung ke        │
   penerima                                        │
   Sebagai customer, saya ingin memilih metode     │ Must Have
   pembayaran (QRIS, Bank Transfer, Credit Card)   │

   D. Success Page

   User Story                                                                       │ Priority
   ---------------------------------------------------------------------------------+----------
   Sebagai customer, saya ingin melihat QR Code voucher setelah pembayaran berhasil │ Must Have
   Sebagai customer, saya ingin download voucher sebagai PDF                        │ Must Have
   Sebagai customer, saya ingin mengirim voucher via WhatsApp atau Email            │ Must Have

   E. Voucher Verification (Public)

   User Story                                                                           │ Priority
   -------------------------------------------------------------------------------------+----------
   Sebagai siapapun, saya ingin memverifikasi validitas voucher dengan memasukkan kode  │ Must Have
   Sebagai verifier, saya ingin melihat status voucher (Active/Redeemed/Expired/Voided) │ Must Have
   Sebagai verifier, saya ingin melihat detail service dan tanggal kadaluarsa           │ Must Have

   F. Review Page

   User Story                                                                   │ Priority
   -----------------------------------------------------------------------------+------------
   Sebagai customer yang sudah redeem, saya ingin memberikan rating 1-5 bintang │ Should Have
   Sebagai customer, saya ingin menulis komentar tentang pengalaman saya        │ Should Have

   ──────────────────────────────────────────

   4.2 Admin Features

   A. Authentication

   User Story                                                  │ Priority
   ------------------------------------------------------------+----------
   Sebagai admin/staff, saya ingin login dengan email dan role │ Must Have
   Sebagai sistem, saya ingin membedakan akses Admin vs Staff  │ Must Have

   B. Dashboard Analytics (Admin Only)

   User Story                                                          │ Priority
   --------------------------------------------------------------------+------------
   Sebagai admin, saya ingin melihat total revenue                     │ Must Have
   Sebagai admin, saya ingin melihat jumlah voucher aktif dan terpakai │ Must Have
   Sebagai admin, saya ingin melihat chart revenue 7 hari terakhir     │ Should Have
   Sebagai admin, saya ingin melihat pie chart service terlaris        │ Should Have

   C. Transaction Management

   User Story                                      │ Priority
   ------------------------------------------------+-------------
   Sebagai admin/staff, saya ingin melihat daftar  │ Must Have
   semua transaksi                                 │
   Sebagai admin/staff, saya ingin filter          │ Must Have
   transaksi berdasarkan status                    │
   Sebagai admin/staff, saya ingin search          │ Must Have
   transaksi berdasarkan kode, nama, email, phone  │
   Sebagai admin, saya ingin extend validity       │ Must Have
   voucher (+30 hari)                              │
   Sebagai admin, saya ingin void voucher dengan   │ Must Have
   alasan                                          │
   Sebagai admin, saya ingin export data transaksi │ Should Have
   ke CSV                                          │
   Sebagai admin, saya ingin copy link review      │ Nice to Have
   untuk diberikan ke customer                     │

   D. POS (Point of Sale)

   User Story                                                                       │ Priority
   ---------------------------------------------------------------------------------+----------
   Sebagai admin, saya ingin membuat voucher manual untuk walk-in customer          │ Must Have
   Sebagai admin, saya ingin memilih payment method termasuk Cash dan Complimentary │ Must Have

   E. Voucher Redemption

   User Story                                                        │ Priority
   ------------------------------------------------------------------+-------------
   Sebagai staff, saya ingin scan QR code voucher dengan kamera      │ Must Have
   Sebagai staff, saya ingin upload gambar QR code dari file         │ Should Have
   Sebagai staff, saya ingin paste gambar QR dari clipboard          │ Nice to Have
   Sebagai staff, saya ingin input kode voucher secara manual        │ Must Have
   Sebagai staff, saya ingin konfirmasi redemption sebelum memproses │ Must Have

   F. Service Management (Admin Only)

   User Story                                                 │ Priority
   -----------------------------------------------------------+------------
   Sebagai admin, saya ingin menambah service baru            │ Must Have
   Sebagai admin, saya ingin mengedit service yang ada        │ Must Have
   Sebagai admin, saya ingin archive service (soft delete)    │ Must Have
   Sebagai admin, saya ingin mengelola facilities per service │ Should Have

   G. Customer History

   User Story                                                         │ Priority
   -------------------------------------------------------------------+------------
   Sebagai admin/staff, saya ingin melihat riwayat pembelian customer │ Should Have
   Sebagai admin/staff, saya ingin kontak customer via WhatsApp       │ Should Have

   H. Audit Log (Admin Only)

   User Story                                                                    │ Priority
   ------------------------------------------------------------------------------+----------
   Sebagai admin, saya ingin melihat log semua aksi staff                        │ Must Have
   Sebagai admin, saya ingin tahu siapa yang melakukan redeem, extend, void, dll │ Must Have

   ──────────────────────────────────────────

   5. Data Models

   Service

   typescript
     interface Service {
       id: string;              // e.g., "srv_001"
       title: string;           // "Royal Javanese Massage"
       description: string;
       durationMin: number;     // 90
       price: number;           // 450000 (IDR)
       image: string;           // URL
       facilities: string[];    // ["Welcome Drink", "Foot Bath"]
       isArchived?: boolean;
     }

   Transaction (Voucher)

   typescript
     interface Transaction {
       id: string;              // "KAL-2025-XXXX"
       serviceId: string;
       customer: Customer;
       purchaseDate: string;
       expiryDate: string;      // +6 months from purchase
       status: VoucherStatus;   // ACTIVE | REDEEMED | EXPIRED | VOIDED
       amount: number;
       paymentMethod: 'QRIS' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CASH' | 'COMPLIMENTARY';
       giftDetails?: GiftDetails;
     }

   Customer

   typescript
     interface Customer {
       name: string;
       email: string;
       phone: string;
       notes?: string;
     }

   GiftDetails

   typescript
     interface GiftDetails {
       isGift: boolean;
       senderName: string;
       recipientName: string;
       message: string;
       sendTo: 'PURCHASER' | 'RECIPIENT';
       recipientEmail?: string;
       recipientPhone?: string;
     }

   ──────────────────────────────────────────

   6. Technical Architecture

   Current State (LocalStorage-based)

     ┌─────────────────────────────────────────────────────────────┐
     │                    React Application                         │
     ├─────────────────────────────────────────────────────────────┤
     │  Pages:                                                      │
     │  - LandingPage (/)                                          │
     │  - VoucherDetail (/voucher/:id)                             │
     │  - Checkout (/checkout/:id)                                 │
     │  - VerifyVoucher (/verify)                                  │
     │  - ReviewPage (/review/:id)                                 │
     │  - AdminLogin (/admin/login)                                │
     │  - AdminDashboard (/admin/dashboard)                        │
     ├─────────────────────────────────────────────────────────────┤
     │  Context Providers:                                          │
     │  - StoreContext (transactions, services, reviews, auditLogs)│
     │  - AuthContext (user, login, logout)                        │
     │  - ToastContext (notifications)                             │
     ├─────────────────────────────────────────────────────────────┤
     │  Storage: LocalStorage (with cross-tab sync)                │
     └─────────────────────────────────────────────────────────────┘

   Key Dependencies
   •  react-router-dom - Routing (HashRouter)
   •  recharts - Dashboard charts
   •  lucide-react - Icons
   •  react-hook-form - Form handling
   •  react-qr-code - QR code display
   •  qrcode - QR code generation for PDF
   •  jspdf - PDF generation
   •  jsqr - QR code scanning
   •  @emailjs/browser - Email sending (simulated)

   ──────────────────────────────────────────

   7. Success Metrics

   Metric                  │ Target       │ Measurement
   ------------------------+--------------+--------------------------------------
   Conversion Rate         │ >15%         │ Visitors ke Checkout / Total Visitors
   Voucher Redemption Rate │ >70%         │ Vouchers Redeemed / Vouchers Sold
   Average Order Value     │ >IDR 500,000 │ Total Revenue / Total Transactions
   Customer Review Rate    │ >30%         │ Reviews / Redeemed Vouchers
   Staff Redemption Time   │ <30 detik    │ Time from scan to confirmation

   ──────────────────────────────────────────

   8. Risks & Mitigations

   Risk                     │ Impact │ Probability │ Mitigation
   -------------------------+--------+-------------+---------------------------------------------
   Data loss (LocalStorage) │ High   │ Medium      │ Migrate ke database (Supabase)
   QR Code fraud            │ High   │ Low         │ Public verify page + unique codes
   Payment integration      │ High   │ Medium      │ Integrate payment gateway (Midtrans/Xendit)
   Email delivery           │ Medium │ Medium      │ Integrate proper email service (SendGrid)
   Multi-device sync        │ Medium │ High        │ Currently using cross-tab sync; need real DB

   ──────────────────────────────────────────

   9. Future Roadmap

   Phase 1 - MVP (Current) ✅
   [x] Public voucher catalog
   [x] Gift voucher checkout
   [x] QR code generation
   [x] Admin dashboard with analytics
   [x] POS voucher creation
   [x] QR redemption (camera + upload)
   [x] Service management
   [x] Audit logging

   Phase 2 - Backend Integration
   [ ] Migrate to Supabase/PostgreSQL
   [ ] Real authentication (Supabase Auth)
   [ ] Payment gateway integration (Midtrans)
   [ ] Real email notifications (SendGrid/EmailJS)
   [ ] WhatsApp Business API integration

   Phase 3 - Enhanced Features
   [ ] Multi-branch support
   [ ] Booking/appointment system
   [ ] Membership/loyalty program
   [ ] Promo code system
   [ ] Advanced reporting & export

   Phase 4 - Mobile & Expansion
   [ ] Mobile app (React Native)
   [ ] Multiple language support
   [ ] Third-party booking integration

   ──────────────────────────────────────────

   10. Open Questions

   1. Payment Gateway: Midtrans atau Xendit untuk payment processing?
   2. Email Service: EmailJS vs SendGrid vs custom SMTP?
   3. Multi-branch: Apakah akan ada multiple spa locations?
   4. Booking System: Apakah voucher langsung include booking atau terpisah?
   5. Validity Period: Fixed 6 bulan atau configurable per service?
   6. Refund Policy: Bagaimana handling void voucher yang sudah dibayar?

   ──────────────────────────────────────────

   Appendix: Current Routes

   Route              │ Component      │ Access
   -------------------+----------------+-------------------------
   `/`                │ LandingPage    │ Public
   `/voucher/:id`     │ VoucherDetail  │ Public
   `/checkout/:id`    │ Checkout       │ Public
   `/verify`          │ VerifyVoucher  │ Public
   `/review/:id`      │ ReviewPage     │ Public (post-redemption)
   `/admin/login`     │ AdminLogin     │ Public
   `/admin/dashboard` │ AdminDashboard │ Protected (Admin/Staff)

   ──────────────────────────────────────────

   Document Version: 1.0
   Last Updated: November 2025
   Author: Product Team