# Product Requirements Document (PRD)
# Kalanara Spa Voucher Platform

**Versi**: 1.0  
**Tanggal**: 15 Desember 2025  
**Status**: MVP Complete  
**Pemilik Produk**: Tim Kalanara Spa

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Pernyataan Masalah](#2-pernyataan-masalah)
3. [Tujuan & Metrik Keberhasilan](#3-tujuan--metrik-keberhasilan)
4. [Pengguna Target](#4-pengguna-target)
5. [Fitur-Fitur Utama](#5-fitur-fitur-utama)
6. [User Stories & Use Cases](#6-user-stories--use-cases)
7. [Arsitektur Teknis](#7-arsitektur-teknis)
8. [Pertimbangan UX/UI](#8-pertimbangan-uxui)
9. [Keamanan](#9-keamanan)
10. [Roadmap Pengembangan](#10-roadmap-pengembangan)
11. [Risiko & Mitigasi](#11-risiko--mitigasi)
12. [Open Questions](#12-open-questions)

---

## 1. Ringkasan Eksekutif

### 1.1 Deskripsi Produk

**Kalanara Spa Voucher Platform** adalah platform digital berbasis web yang memungkinkan pelanggan untuk membeli, mengirim, dan me-redeem voucher hadiah untuk layanan spa di Kalanara Spa, Bekasi. Platform ini menyediakan pengalaman end-to-end mulai dari pemilihan layanan, pembayaran, pengiriman voucher, hingga verifikasi dan redemption di lokasi spa.

### 1.2 Visi

Menjadi platform voucher spa digital terdepan di Indonesia yang memberikan kemudahan dalam memberikan hadiah wellness kepada orang tersayang.

### 1.3 Misi

- Menyederhanakan proses pembelian dan pengiriman voucher spa
- Memberikan pengalaman pengguna yang premium dan seamless
- Mendukung pertumbuhan bisnis Kalanara Spa melalui channel digital

### 1.4 Proposisi Nilai

| Untuk | Nilai |
|-------|-------|
| Pembeli | Kemudahan membeli hadiah spa dalam hitungan menit dengan berbagai metode pembayaran |
| Penerima | Voucher digital yang mudah disimpan, diverifikasi, dan di-redeem |
| Kalanara Spa | Peningkatan revenue melalui channel digital dengan sistem manajemen terintegrasi |

### 1.5 Lokasi & Pasar

- **Lokasi Spa**: Jl. Raya Ubud No. 88, Ubud, Bali (berdasarkan data dummy)
- **Target Pasar**: Pasar Indonesia dengan mata uang IDR
- **Bahasa**: Bahasa Indonesia untuk seluruh antarmuka pengguna

---

## 2. Pernyataan Masalah

### 2.1 Masalah yang Dihadapi

#### Bagi Pembeli
- **Keterbatasan waktu**: Kesulitan mengunjungi spa secara fisik hanya untuk membeli voucher
- **Proses manual**: Voucher fisik memerlukan pengambilan atau pengiriman yang memakan waktu
- **Fleksibilitas pembayaran**: Terbatasnya opsi pembayaran untuk voucher tradisional

#### Bagi Penerima
- **Risiko kehilangan**: Voucher fisik mudah hilang atau rusak
- **Ketidakpastian status**: Tidak ada cara mudah untuk memverifikasi validitas voucher
- **Informasi terbatas**: Detail layanan dan masa berlaku sering tidak jelas

#### Bagi Bisnis (Kalanara Spa)
- **Tracking manual**: Kesulitan melacak status voucher dan redemption
- **Fraud risk**: Potensi pemalsuan voucher fisik
- **Lost opportunity**: Pelanggan potensial yang tidak bisa datang ke lokasi untuk membeli

### 2.2 Solusi yang Ditawarkan

Platform digital yang menyediakan:
- Pembelian voucher online 24/7
- Pengiriman instan via WhatsApp dan Email
- Verifikasi real-time dengan QR code
- Dashboard admin untuk manajemen voucher

---

## 3. Tujuan & Metrik Keberhasilan

### 3.1 Tujuan Bisnis

| Tujuan | Target | Timeline |
|--------|--------|----------|
| Meningkatkan penjualan voucher | +30% dari baseline | 6 bulan |
| Mendigitalisasi 80% transaksi voucher | 80% | 12 bulan |
| Mengurangi fraud voucher | 0 kasus | Ongoing |

### 3.2 Key Performance Indicators (KPIs)

#### Metrik Konversi
| Metrik | Target | Pengukuran |
|--------|--------|------------|
| Conversion Rate | > 3% | Visitors → Purchases |
| Cart Abandonment Rate | < 40% | Checkout initiated → Completed |
| Payment Success Rate | > 95% | Payment attempted → Successful |

#### Metrik Voucher
| Metrik | Target | Pengukuran |
|--------|--------|------------|
| Redemption Rate | > 70% | Vouchers sold → Redeemed |
| Average Time to Redeem | < 60 hari | Purchase date → Redeem date |
| Expired Voucher Rate | < 15% | Total vouchers → Expired without use |

#### Metrik Kepuasan
| Metrik | Target | Pengukuran |
|--------|--------|------------|
| Average Rating | > 4.5/5 | Post-redemption reviews |
| NPS Score | > 50 | Customer surveys |
| Support Ticket Volume | < 5% of transactions | Tickets / Orders |

### 3.3 Metrik Teknis

| Metrik | Target |
|--------|--------|
| Page Load Time | < 3 detik |
| Checkout Completion Time | < 5 menit |
| System Uptime | > 99.5% |
| Error Rate | < 0.1% |

---

## 4. Pengguna Target

### 4.1 Persona Pembeli

#### Persona 1: "Gift Giver" - Maya (32 tahun)
- **Profil**: Profesional di Jakarta, sibuk dengan pekerjaan
- **Kebutuhan**: Memberikan hadiah ulang tahun untuk ibu tanpa harus ke lokasi
- **Pain Points**: Waktu terbatas, tidak familiar dengan lokasi spa
- **Goals**: Proses cepat, pengiriman langsung ke penerima, presentasi hadiah yang premium

#### Persona 2: "Self-Care Purchaser" - Andi (28 tahun)
- **Profil**: Pengusaha muda yang sering stress
- **Kebutuhan**: Membeli voucher untuk diri sendiri sebagai reward
- **Pain Points**: Ingin fleksibilitas kapan akan redeem
- **Goals**: Mudah disimpan, bisa digunakan kapan saja dalam masa berlaku

#### Persona 3: "Corporate Buyer" - HR Manager
- **Profil**: Tim HR perusahaan menengah
- **Kebutuhan**: Membeli voucher sebagai benefit karyawan
- **Pain Points**: Membutuhkan bukti pembelian dan tracking
- **Goals**: Proses bulk purchase, invoice untuk accounting

### 4.2 Persona Penerima

#### Karakteristik Umum
- Usia: 25-55 tahun
- Familiar dengan smartphone dan messaging apps
- Preferensi komunikasi: WhatsApp > Email
- Membutuhkan kemudahan verifikasi dan redemption

### 4.3 Persona Admin

#### Admin Roles

| Role | Akses | Responsibilities |
|------|-------|------------------|
| Super Admin | Full access | System configuration, user management, all operations |
| Manager | Dashboard, vouchers, orders, services | Daily operations, reporting, customer service |
| Staff | Limited view | Voucher verification, redemption only |

---

## 5. Fitur-Fitur Utama

### 5.1 Modul Publik (Customer-Facing)

#### 5.1.1 Landing Page
**Deskripsi**: Halaman utama yang menampilkan katalog layanan spa dan value proposition.

**Komponen**:
- Hero section dengan CTA utama
- Katalog layanan spa dengan filter kategori
- Section testimonial dari pelanggan
- Trust indicators (keamanan, garansi)
- Footer dengan informasi kontak dan sosial media

**Kategori Layanan**:
| Kategori | Deskripsi | Range Harga |
|----------|-----------|-------------|
| Massage | Pijat tradisional dan modern | Rp 750.000 - Rp 950.000 |
| Facial | Perawatan wajah | Rp 650.000 - Rp 1.200.000 |
| Body Treatment | Scrub, wrap, bath | Rp 550.000 - Rp 800.000 |
| Package | Paket lengkap | Rp 2.500.000 - Rp 5.500.000 |

#### 5.1.2 Checkout Flow
**Deskripsi**: Proses pembelian voucher dari pemilihan hingga pembayaran.

**Steps**:
1. **Service Selection**: Pilih layanan dari katalog
2. **Customer Info**: Input data pembeli (nama, email, WhatsApp)
3. **Recipient Info**: Input data penerima (nama, WhatsApp, pesan opsional)
4. **Delivery Options**: Pilih metode pengiriman dan target penerima
5. **Payment**: Proses pembayaran via Midtrans
6. **Confirmation**: Tampilan sukses dengan opsi kirim ulang

**Opsi Pengiriman**:
| Opsi | Deskripsi |
|------|-----------|
| WhatsApp | Pesan otomatis dengan link voucher (Recommended) |
| Email | Email dengan PDF voucher attachment |
| Both | WhatsApp + Email |

**Target Pengiriman**:
| Target | Use Case |
|--------|----------|
| Langsung ke Penerima | Surprise gift |
| Kirim ke Pembeli | Pembeli ingin memberikan sendiri |

#### 5.1.3 Integrasi Pembayaran Midtrans
**Deskripsi**: Payment gateway untuk berbagai metode pembayaran Indonesia.

**Metode Pembayaran**:
| Kategori | Opsi |
|----------|------|
| Credit/Debit Card | Visa, Mastercard, AMEX |
| Bank Transfer | BCA, Mandiri, BNI, BRI |
| E-Wallet | GoPay, OVO, DANA, ShopeePay |
| QRIS | Semua bank dan e-wallet |

**Flow Pembayaran**:
1. User klik "Bayar Sekarang"
2. Create transaction via API
3. Midtrans Snap popup muncul
4. User pilih metode dan selesaikan pembayaran
5. Webhook notification untuk update status
6. Voucher dibuat dan dikirim otomatis

#### 5.1.4 Verifikasi Voucher
**Deskripsi**: Halaman untuk memverifikasi status dan detail voucher.

**Fitur**:
- Input manual kode voucher
- QR code scanner (kamera atau upload file)
- Support deep link dari WhatsApp (`/verify?code=XXX`)
- Display status: Valid, Redeemed, atau Expired
- Download PDF voucher (jika valid)

**Status Voucher**:
| Status | Warna | Aksi |
|--------|-------|------|
| Valid | Green | Dapat di-redeem |
| Redeemed | Blue | Sudah digunakan |
| Expired | Red | Masa berlaku habis |

#### 5.1.5 Post-Redemption Review
**Deskripsi**: Form review setelah voucher di-redeem.

**Fields**:
- Rating (1-5 bintang)
- Komentar (opsional)
- Nama reviewer

### 5.2 Modul Admin Dashboard

#### 5.2.1 Dashboard Analytics
**Deskripsi**: Overview performa bisnis dengan visualisasi data.

**Metrics Displayed**:
- Total Revenue
- Active Vouchers
- Redeemed Vouchers
- Expired Vouchers
- Total Orders
- Average Rating

**Visualisasi**:
- Line chart: Revenue trend (7 hari terakhir)
- Bar chart: Orders per hari
- Recent orders list
- Recent reviews list

#### 5.2.2 Manajemen Voucher
**Deskripsi**: CRUD dan operasi khusus untuk voucher.

**Operasi**:
| Aksi | Deskripsi |
|------|-----------|
| View | Lihat detail voucher dan history |
| Redeem | Tandai voucher sebagai digunakan |
| Extend | Perpanjang masa berlaku |
| Void | Batalkan voucher |

**Filter & Search**:
- Status (Active, Redeemed, Expired)
- Date range
- Service type
- Search by code/recipient name

#### 5.2.3 Manajemen Services
**Deskripsi**: CRUD untuk layanan spa.

**Fields**:
| Field | Type | Required |
|-------|------|----------|
| Name | Text | Yes |
| Description | Textarea | No |
| Duration | Number (minutes) | Yes |
| Price | Number (IDR) | Yes |
| Category | Enum | Yes |
| Image URL | URL | No |
| Is Active | Boolean | Yes |

#### 5.2.4 Manajemen Purchases/Orders
**Deskripsi**: Tracking dan manajemen transaksi.

**Data Displayed**:
- Order ID
- Customer info
- Service purchased
- Payment status
- Payment method
- Total amount
- Created date
- Midtrans transaction ID

**Filter Options**:
- Payment status (Pending, Completed, Failed, Refunded)
- Date range
- Payment method

#### 5.2.5 Manajemen Reviews
**Deskripsi**: Moderasi review pelanggan.

**Operasi**:
- View all reviews
- Filter by rating
- Delete inappropriate reviews

#### 5.2.6 User Management
**Deskripsi**: Manajemen admin users.

**Operasi**:
- Create admin user
- Update role
- Deactivate user

#### 5.2.7 Settings
**Deskripsi**: Konfigurasi sistem.

**Options**:
- Voucher validity period
- Email templates
- Notification settings

#### 5.2.8 Help Center
**Deskripsi**: Dokumentasi dan panduan untuk admin.

---

## 6. User Stories & Use Cases

### 6.1 User Stories - Pembeli

#### US-001: Pembelian Voucher
```
Sebagai pembeli,
Saya ingin membeli voucher spa secara online
Agar saya dapat memberikan hadiah tanpa harus ke lokasi spa
```

**Acceptance Criteria**:
- [ ] Dapat melihat katalog layanan dengan harga
- [ ] Dapat memilih layanan dan melanjutkan ke checkout
- [ ] Dapat mengisi data pembeli dan penerima
- [ ] Dapat memilih metode pembayaran
- [ ] Menerima konfirmasi setelah pembayaran berhasil

#### US-002: Pengiriman ke Penerima
```
Sebagai pembeli,
Saya ingin voucher dikirim langsung ke penerima via WhatsApp
Agar penerima mendapat surprise gift
```

**Acceptance Criteria**:
- [ ] Dapat memilih opsi "Kirim ke Penerima"
- [ ] Dapat input nomor WhatsApp penerima
- [ ] Voucher terkirim otomatis setelah pembayaran sukses
- [ ] Pesan WhatsApp berisi link verifikasi voucher

#### US-003: Menambahkan Pesan Personal
```
Sebagai pembeli,
Saya ingin menambahkan pesan personal di voucher
Agar hadiah terasa lebih bermakna
```

**Acceptance Criteria**:
- [ ] Field pesan opsional tersedia di form
- [ ] Pesan tampil di voucher PDF
- [ ] Pesan terkirim bersama voucher via WhatsApp/Email

### 6.2 User Stories - Penerima

#### US-004: Verifikasi Voucher
```
Sebagai penerima voucher,
Saya ingin memverifikasi voucher yang saya terima
Agar saya yakin voucher valid dan tahu detailnya
```

**Acceptance Criteria**:
- [ ] Dapat akses halaman verifikasi dari link di WhatsApp
- [ ] Dapat input kode voucher manual
- [ ] Dapat scan QR code
- [ ] Melihat status, layanan, dan masa berlaku

#### US-005: Download PDF Voucher
```
Sebagai penerima voucher,
Saya ingin download PDF voucher
Agar saya punya backup dan bisa print jika perlu
```

**Acceptance Criteria**:
- [ ] Tombol download tersedia di halaman verifikasi (jika valid)
- [ ] PDF berisi QR code, detail layanan, dan masa berlaku
- [ ] PDF memiliki design premium

### 6.3 User Stories - Admin

#### US-006: Dashboard Overview
```
Sebagai admin,
Saya ingin melihat dashboard dengan metrik bisnis
Agar saya dapat memantau performa penjualan
```

**Acceptance Criteria**:
- [ ] Melihat total revenue
- [ ] Melihat jumlah voucher (active, redeemed, expired)
- [ ] Melihat grafik trend
- [ ] Melihat recent orders dan reviews

#### US-007: Redeem Voucher
```
Sebagai staff spa,
Saya ingin me-redeem voucher saat pelanggan datang
Agar voucher tidak dapat digunakan dua kali
```

**Acceptance Criteria**:
- [ ] Dapat scan atau input kode voucher
- [ ] Sistem validasi status voucher
- [ ] Dapat menandai voucher sebagai redeemed
- [ ] Timestamp redemption tercatat

#### US-008: Extend Voucher
```
Sebagai manager,
Saya ingin memperpanjang masa berlaku voucher
Agar dapat mengakomodasi request pelanggan
```

**Acceptance Criteria**:
- [ ] Dapat memilih voucher yang akan diperpanjang
- [ ] Dapat input tanggal expiry baru
- [ ] History perubahan tercatat

### 6.4 Use Case Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Kalanara Spa Platform                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐                              ┌─────────────┐   │
│  │ Pembeli │                              │   Admin     │   │
│  └────┬────┘                              └──────┬──────┘   │
│       │                                          │          │
│       ├── Browse Services                        ├── Login  │
│       ├── Checkout                               ├── View Dashboard │
│       ├── Make Payment                           ├── Manage Vouchers │
│       └── Receive Confirmation                   ├── Manage Services │
│                                                  ├── Manage Orders │
│  ┌──────────┐                                    ├── Manage Reviews │
│  │ Penerima │                                    └── Manage Users │
│  └────┬─────┘                                              │
│       │                                                     │
│       ├── Receive Voucher (WhatsApp/Email)                 │
│       ├── Verify Voucher                                   │
│       ├── Download PDF                                     │
│       └── Submit Review (after redemption)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Arsitektur Teknis

### 7.1 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 16.0.10 |
| UI Library | React | 19.2.0 |
| Language | TypeScript | 5.x |
| Styling | TailwindCSS | 4.x |
| UI Components | shadcn/ui | Latest |
| Database | Supabase (PostgreSQL) | - |
| Authentication | Supabase Auth | - |
| State Management | Zustand | 5.0.8 |
| Forms | react-hook-form | 7.67.0 |
| Charts | Recharts | 3.5.1 |
| Payment | Midtrans Snap | - |
| Email | Resend | 6.5.2 |
| PDF Generation | jspdf + qrcode | 3.0.4 |
| QR Scanning | jsqr | 1.4.0 |
| Testing | Vitest | 4.0.15 |

### 7.2 Database Schema

#### Tables

**services**
```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- minutes
  price NUMERIC NOT NULL,
  category service_category NOT NULL,
  image_url VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**vouchers**
```sql
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR UNIQUE NOT NULL,
  service_id UUID REFERENCES services(id),
  recipient_name VARCHAR NOT NULL,
  recipient_email VARCHAR NOT NULL,
  sender_name VARCHAR NOT NULL,
  sender_message TEXT,
  purchase_date TIMESTAMP DEFAULT now(),
  expiry_date TIMESTAMP NOT NULL,
  is_redeemed BOOLEAN DEFAULT false,
  redeemed_at TIMESTAMP,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
```

**orders**
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id),
  customer_email VARCHAR NOT NULL,
  customer_name VARCHAR NOT NULL,
  customer_phone VARCHAR NOT NULL,
  payment_method payment_method NOT NULL,
  payment_status payment_status DEFAULT 'PENDING',
  total_amount NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  -- Midtrans fields
  midtrans_order_id VARCHAR,
  midtrans_transaction_id VARCHAR,
  midtrans_payment_type VARCHAR,
  midtrans_transaction_time TIMESTAMP,
  -- Recipient info (for pending orders)
  service_id UUID REFERENCES services(id),
  recipient_name VARCHAR,
  recipient_email VARCHAR,
  recipient_phone VARCHAR,
  sender_message TEXT,
  delivery_method delivery_method,
  send_to send_to
);
```

**reviews**
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  customer_name VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
```

**admins**
```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  role admin_role DEFAULT 'STAFF',
  created_at TIMESTAMP DEFAULT now()
);
```

#### Enums

```sql
CREATE TYPE service_category AS ENUM ('MASSAGE', 'FACIAL', 'BODY_TREATMENT', 'PACKAGE');
CREATE TYPE payment_method AS ENUM ('CREDIT_CARD', 'BANK_TRANSFER', 'E_WALLET');
CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE delivery_method AS ENUM ('EMAIL', 'WHATSAPP', 'BOTH');
CREATE TYPE send_to AS ENUM ('PURCHASER', 'RECIPIENT');
CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'MANAGER', 'STAFF');
```

### 7.3 API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/midtrans/create-transaction` | POST | Create Midtrans Snap transaction |
| `/api/midtrans/notification` | POST | Webhook for payment notifications |
| `/api/email/send-voucher` | POST | Send voucher via Resend email |
| `/api/whatsapp/send-voucher` | POST | Generate WhatsApp URL |

### 7.4 Integrasi Pihak Ketiga

#### Midtrans
- **Purpose**: Payment gateway
- **Integration**: Snap.js popup
- **Webhook**: Notification URL untuk update status
- **Environment**: Sandbox (development) / Production

#### Resend
- **Purpose**: Transactional email
- **Usage**: Sending voucher emails dengan PDF

#### WhatsApp
- **Purpose**: Voucher delivery
- **Method**: wa.me URL dengan pre-filled message
- **Format**: Deep link dengan voucher info

### 7.5 Folder Structure

```
kalanara-spa-prod/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Landing page
│   ├── checkout/[id]/     # Checkout flow
│   ├── voucher/[id]/      # Voucher detail
│   ├── verify/            # Voucher verification
│   ├── review/[id]/       # Post-redemption review
│   ├── admin/             # Admin dashboard
│   │   ├── dashboard/
│   │   ├── vouchers/
│   │   ├── services/
│   │   ├── purchases/
│   │   ├── reviews/
│   │   ├── users/
│   │   ├── settings/
│   │   └── help/
│   └── api/               # API routes
│       ├── midtrans/
│       └── email/
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── admin/            # Admin-specific components
├── lib/                   # Utilities & business logic
│   ├── actions/          # Server Actions
│   ├── midtrans/         # Midtrans integration
│   ├── supabase/         # Supabase clients
│   └── utils/            # Helper functions
├── context/              # React Context providers
├── hooks/                # Custom React hooks
├── store/                # Zustand stores
└── public/               # Static assets
```

---

## 8. Pertimbangan UX/UI

### 8.1 Design Principles

1. **Premium Feel**: Design yang mencerminkan luxury spa experience
2. **Mobile-First**: Optimasi untuk pengguna smartphone Indonesia
3. **Simplicity**: Flow yang simpel dan intuitif
4. **Trust**: Elemen yang membangun kepercayaan (security badges, testimonials)

### 8.2 Responsive Design

| Breakpoint | Target Device |
|------------|---------------|
| < 640px | Mobile phones |
| 640-768px | Large phones, small tablets |
| 768-1024px | Tablets |
| > 1024px | Desktop |

### 8.3 Color Palette

| Color | Usage | CSS Variable |
|-------|-------|--------------|
| Primary | CTA buttons, headers | `--primary` |
| Accent | Highlights, badges | `--accent` |
| Success | Valid status, confirmations | `--success` |
| Destructive | Errors, warnings | `--destructive` |
| Muted | Secondary text, backgrounds | `--muted` |

### 8.4 Animation System

**Keyframes** (defined in `globals.css`):
- `fadeSlideUp`: Content reveal dari bawah
- `fadeSlideDown`: Content reveal dari atas
- `scaleIn`: Modal/card entrance
- `slideInLeft`: Navigation animations
- `checkmarkPop`: Success indicator

**Utility Classes**:
- `animate-fade-slide-up`: Fade + slide up
- `animate-scale-in`: Scale entrance
- `animate-stagger-1` to `-6`: Stagger delays
- `btn-hover-lift`: Button hover effect
- `card-hover-lift`: Card hover effect

**Accessibility**:
- Semua animasi respect `prefers-reduced-motion`

### 8.5 Typography

| Element | Font | Size |
|---------|------|------|
| H1 (Hero) | Sans-serif | 4xl-8xl responsive |
| H2 (Section) | Sans-serif | 2xl-4xl |
| Body | Sans-serif | base-lg |
| Voucher Code | Monospace | lg-2xl |

### 8.6 Dark/Light Mode

- Dukungan penuh untuk dark dan light mode
- Menggunakan `next-themes` untuk switching
- CSS variables untuk adaptive colors

---

## 9. Keamanan

### 9.1 Authentication & Authorization

#### Admin Authentication
- Supabase Auth dengan email/password
- Session-based authentication
- Middleware protection untuk admin routes

#### Role-Based Access Control (RBAC)
| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | Full access, user management |
| MANAGER | Vouchers, orders, services, reviews |
| STAFF | Voucher verification, redemption |

### 9.2 Row Level Security (RLS)

```sql
-- Public read untuk services aktif
CREATE POLICY "Public can view active services" ON services
  FOR SELECT USING (is_active = true);

-- Only admin can modify services
CREATE POLICY "Admin can manage services" ON services
  FOR ALL USING (is_admin());

-- Voucher access control
CREATE POLICY "Public can view voucher by code" ON vouchers
  FOR SELECT USING (true);

-- Only admin can manage vouchers
CREATE POLICY "Admin can manage vouchers" ON vouchers
  FOR ALL USING (is_admin());
```

### 9.3 Payment Security

#### Midtrans Webhook Verification
- SHA512 signature verification
- Server key validation
- Order ID matching

```typescript
function verifySignature(notification, serverKey) {
  const signatureKey = crypto
    .createHash("sha512")
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest("hex");
  return notification.signature_key === signatureKey;
}
```

### 9.4 Environment Variables Protection

| Variable | Scope | Usage |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Public API access |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin operations |
| `MIDTRANS_SERVER_KEY` | Server only | Webhook verification |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Client | Snap.js initialization |
| `RESEND_API_KEY` | Server only | Email sending |

### 9.5 Input Validation

- Phone number format: `+62` atau `08` prefix
- Email validation via regex
- Voucher code format: `KSP-YYYY-XXXXXXXX`
- Amount validation untuk prevent tampering

### 9.6 XSS & CSRF Protection

- Next.js built-in protections
- Sanitized user inputs
- HTTP-only cookies untuk sessions

---

## 10. Roadmap Pengembangan

### 10.1 Fase Saat Ini (MVP) - Complete ✅

| Feature | Status |
|---------|--------|
| Landing page dengan katalog | ✅ |
| Checkout flow | ✅ |
| Midtrans payment integration | ✅ |
| WhatsApp/Email delivery | ✅ |
| Voucher verification (QR + manual) | ✅ |
| Admin dashboard | ✅ |
| Voucher management | ✅ |
| Order management | ✅ |
| Review system | ✅ |

### 10.2 Fase 2 - Enhancements (Q1 2026)

| Feature | Priority | Effort |
|---------|----------|--------|
| Bulk purchase untuk corporate | High | Medium |
| Promo codes / discounts | High | Low |
| Email templates customization | Medium | Low |
| Multi-language support | Medium | High |
| Analytics dashboard enhancements | Medium | Medium |

### 10.3 Fase 3 - Expansion (Q2 2026)

| Feature | Priority | Effort |
|---------|----------|--------|
| Mobile app (React Native) | High | High |
| Recurring purchase / subscription | Medium | High |
| Loyalty program integration | Medium | High |
| API untuk third-party resellers | Low | Medium |
| Multi-location support | Low | High |

### 10.4 Technical Debt & Improvements

| Item | Priority |
|------|----------|
| Unit test coverage > 80% | High |
| E2E testing dengan Playwright | Medium |
| Performance optimization (Core Web Vitals) | High |
| SEO optimization | Medium |
| Accessibility audit (WCAG 2.1) | Medium |

---

## 11. Risiko & Mitigasi

### 11.1 Risiko Teknis

| Risiko | Dampak | Likelihood | Mitigasi |
|--------|--------|------------|----------|
| Payment gateway downtime | High | Low | Fallback message, retry mechanism |
| Email delivery failure | Medium | Medium | WhatsApp as primary, email backup |
| Database outage | Critical | Very Low | Supabase managed + backups |
| WhatsApp API rate limiting | Medium | Low | Queue system, rate limiting |

### 11.2 Risiko Bisnis

| Risiko | Dampak | Likelihood | Mitigasi |
|--------|--------|------------|----------|
| Voucher fraud | High | Low | QR verification, unique codes |
| High expiry rate | Medium | Medium | Reminder notifications |
| Chargeback/refund abuse | Medium | Low | Clear T&C, verification process |
| Competitor copy | Low | Medium | Continuous improvement, brand loyalty |

### 11.3 Risiko Operasional

| Risiko | Dampak | Likelihood | Mitigasi |
|--------|--------|------------|----------|
| Staff training gap | Medium | Medium | Documentation, help center |
| Customer support overload | Medium | Medium | Self-service verification page |
| Data loss | Critical | Very Low | Regular backups, RLS |

---

## 12. Open Questions

### 12.1 Keputusan yang Pending

| Question | Context | Decision Needed By |
|----------|---------|-------------------|
| Voucher validity period default | Saat ini 365 hari, apakah perlu diubah? | Product Owner |
| Refund policy | Belum ada fitur refund otomatis | Product Owner |
| Corporate pricing | Apakah perlu tiered pricing untuk bulk? | Business |
| Notification frequency | Reminder sebelum expiry berapa kali? | Product Owner |

### 12.2 Technical Decisions

| Question | Options | Recommendation |
|----------|---------|----------------|
| Image storage | Supabase Storage vs Cloudinary | Supabase Storage (integrated) |
| Email template engine | React Email vs Resend templates | React Email (more flexible) |
| Analytics platform | Supabase Analytics vs Mixpanel | Start with Supabase, migrate if needed |

### 12.3 Scope Clarifications

| Item | Clarification Needed |
|------|---------------------|
| Partial redemption | Apakah voucher bisa digunakan sebagian? |
| Transfer voucher | Apakah penerima bisa transfer ke orang lain? |
| Combine vouchers | Apakah bisa combine multiple vouchers? |
| Cash out | Apakah voucher bisa diuangkan? |

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| Voucher | Digital gift certificate untuk layanan spa |
| Redemption | Proses menggunakan voucher di lokasi spa |
| Snap | Midtrans payment popup interface |
| RLS | Row Level Security - Supabase database security feature |
| Deep Link | URL yang langsung membuka halaman spesifik dengan parameter |

### B. References

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Midtrans Documentation](https://docs.midtrans.com)
- [shadcn/ui Components](https://ui.shadcn.com)

### C. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-15 | AI Assistant | Initial PRD creation |

---

*Dokumen ini adalah living document yang akan diupdate sesuai dengan perkembangan produk.*
