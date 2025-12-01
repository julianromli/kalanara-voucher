import {
  type Service,
  type Voucher,
  type Admin,
  ServiceCategory,
  PaymentStatus,
  AdminRole,
} from "./types";

// ============================================================================
// App Configuration
// ============================================================================

export const APP_CONFIG = {
  name: "Kalanara Spa",
  tagline: "Harmony in Every Touch",
  description:
    "Experience the art of relaxation at Kalanara Spa. Gift wellness and serenity with our exclusive spa vouchers.",
  contact: {
    phone: "+62 361 123 4567",
    email: "hello@kalanaraspa.com",
    address: "Jl. Raya Ubud No. 88, Ubud, Bali 80571, Indonesia",
  },
  social: {
    instagram: "https://instagram.com/kalanaraspa",
    facebook: "https://facebook.com/kalanaraspa",
    whatsapp: "https://wa.me/62361234567",
  },
  voucherValidity: 365, // days
  currency: "IDR",
  currencySymbol: "Rp",
  defaultAvatarUrl: "https://github.com/haydenbleasel.png",
} as const;

// ============================================================================
// Navigation Links
// ============================================================================

export const NAV_LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/#vouchers", label: "Gift Vouchers" },
  { href: "/#about", label: "About" },
  { href: "/verify", label: "Verify Voucher" },
] as const;

// ============================================================================
// Services Data
// ============================================================================

export const SERVICES: readonly Service[] = [
  {
    id: "srv-001",
    name: "Balinese Traditional Massage",
    description:
      "A centuries-old healing technique combining gentle stretches, acupressure, and aromatherapy. This full-body treatment improves blood circulation, relieves muscle tension, and promotes deep relaxation.",
    duration: 90,
    price: 850000,
    category: ServiceCategory.MASSAGE,
    image: "/images/services/balinese-massage.jpg",
  },
  {
    id: "srv-002",
    name: "Hot Stone Therapy",
    description:
      "Smooth, heated volcanic stones are placed on key points of your body while our therapists use warm stones to massage your muscles. The penetrating heat melts away tension and stress.",
    duration: 75,
    price: 950000,
    category: ServiceCategory.MASSAGE,
    image: "/images/services/hot-stone.jpg",
  },
  {
    id: "srv-003",
    name: "Deep Tissue Massage",
    description:
      "Focused pressure techniques target chronic muscle tension and knots in deeper layers of muscle tissue. Ideal for athletes and those with persistent muscle pain.",
    duration: 60,
    price: 750000,
    category: ServiceCategory.MASSAGE,
    image: "/images/services/deep-tissue.jpg",
  },
  {
    id: "srv-004",
    name: "Luminous Glow Facial",
    description:
      "A luxurious facial treatment using organic ingredients to cleanse, exfoliate, and hydrate. Includes a facial massage, mask, and LED light therapy for radiant, glowing skin.",
    duration: 60,
    price: 650000,
    category: ServiceCategory.FACIAL,
    image: "/images/services/facial-glow.jpg",
  },
  {
    id: "srv-005",
    name: "Anti-Aging Renewal Facial",
    description:
      "Advanced skincare treatment featuring collagen-boosting serums, microcurrent therapy, and jade roller massage. Reduces fine lines and restores youthful vitality.",
    duration: 90,
    price: 1200000,
    category: ServiceCategory.FACIAL,
    image: "/images/services/anti-aging.jpg",
  },
  {
    id: "srv-006",
    name: "Boreh Body Scrub & Wrap",
    description:
      "Traditional Balinese treatment using a warming blend of spices, rice, and herbs. This detoxifying scrub is followed by a nourishing body wrap to soften and rejuvenate skin.",
    duration: 120,
    price: 800000,
    category: ServiceCategory.BODY_TREATMENT,
    image: "/images/services/boreh-scrub.jpg",
  },
  {
    id: "srv-007",
    name: "Coconut Milk Bath Ritual",
    description:
      "Immerse yourself in a luxurious bath of fresh coconut milk, flower petals, and essential oils. This royal treatment softens skin and calms the mind.",
    duration: 45,
    price: 550000,
    category: ServiceCategory.BODY_TREATMENT,
    image: "/images/services/milk-bath.jpg",
  },
  {
    id: "srv-008",
    name: "Harmony Half-Day Retreat",
    description:
      "Complete spa journey including Balinese massage, facial treatment, body scrub, and flower bath. Includes healthy lunch and herbal refreshments.",
    duration: 240,
    price: 2500000,
    category: ServiceCategory.PACKAGE,
    image: "/images/services/half-day-retreat.jpg",
  },
  {
    id: "srv-009",
    name: "Couples Bliss Package",
    description:
      "Share the experience of relaxation with your loved one. Includes side-by-side massages, facial treatments, and a private flower bath with champagne.",
    duration: 180,
    price: 3800000,
    category: ServiceCategory.PACKAGE,
    image: "/images/services/couples-package.jpg",
  },
  {
    id: "srv-010",
    name: "Ultimate Wellness Day",
    description:
      "The complete Kalanara experience. Full day of treatments including massage, facial, body scrub, bath ritual, manicure, pedicure, and gourmet lunch.",
    duration: 480,
    price: 5500000,
    category: ServiceCategory.PACKAGE,
    image: "/images/services/full-day-retreat.jpg",
  },
] as const;

// ============================================================================
// Sample Vouchers (for demo/testing)
// ============================================================================

export const SAMPLE_VOUCHERS: readonly Voucher[] = [
  {
    id: "vch-001",
    code: "KSP-2024-ABCD1234",
    service: SERVICES[0],
    recipientName: "Sarah Johnson",
    recipientEmail: "sarah@example.com",
    senderName: "Michael Johnson",
    senderMessage:
      "Happy Birthday! Enjoy some well-deserved relaxation. Love you!",
    purchaseDate: new Date("2024-01-15"),
    expiryDate: new Date("2025-01-15"),
    isRedeemed: false,
    amount: 850000,
  },
  {
    id: "vch-002",
    code: "KSP-2024-EFGH5678",
    service: SERVICES[8],
    recipientName: "Emily & David Chen",
    recipientEmail: "emily.chen@example.com",
    senderName: "Rachel Chen",
    senderMessage:
      "Congratulations on your anniversary! Wishing you both a wonderful spa day together.",
    purchaseDate: new Date("2024-02-10"),
    expiryDate: new Date("2025-02-10"),
    isRedeemed: true,
    redeemedDate: new Date("2024-03-05"),
    amount: 3800000,
  },
] as const;

// ============================================================================
// Admin Users (for demo/testing)
// ============================================================================

export const DEMO_ADMIN: Admin = {
  id: "adm-001",
  email: "admin@kalanaraspa.com",
  name: "Admin User",
  role: AdminRole.SUPER_ADMIN,
};

export const ADMIN_CREDENTIALS = {
  email: "admin@kalanaraspa.com",
  password: "admin123", // Demo only - never use in production
} as const;

// ============================================================================
// Service Categories Config
// ============================================================================

export const SERVICE_CATEGORIES = [
  {
    value: ServiceCategory.MASSAGE,
    label: "Massage Therapy",
    description: "Healing touch for body and soul",
    icon: "Sparkles",
  },
  {
    value: ServiceCategory.FACIAL,
    label: "Facial Treatments",
    description: "Radiance and rejuvenation",
    icon: "Flower2",
  },
  {
    value: ServiceCategory.BODY_TREATMENT,
    label: "Body Treatments",
    description: "Nourish and revitalize",
    icon: "Leaf",
  },
  {
    value: ServiceCategory.PACKAGE,
    label: "Spa Packages",
    description: "Complete wellness experiences",
    icon: "Gift",
  },
] as const;

// ============================================================================
// Payment Methods Config
// ============================================================================

export const PAYMENT_METHODS = [
  {
    value: "CREDIT_CARD",
    label: "Credit/Debit Card",
    description: "Visa, Mastercard, AMEX",
    icon: "CreditCard",
  },
  {
    value: "BANK_TRANSFER",
    label: "Bank Transfer",
    description: "BCA, Mandiri, BNI, BRI",
    icon: "Building2",
  },
  {
    value: "E_WALLET",
    label: "E-Wallet",
    description: "GoPay, OVO, DANA, ShopeePay",
    icon: "Wallet",
  },
] as const;

// ============================================================================
// Payment Status Config
// ============================================================================

export const PAYMENT_STATUS_CONFIG = {
  [PaymentStatus.PENDING]: {
    label: "Pending",
    color: "text-amber-600 bg-amber-50",
    icon: "Clock",
  },
  [PaymentStatus.COMPLETED]: {
    label: "Completed",
    color: "text-emerald-600 bg-emerald-50",
    icon: "CheckCircle",
  },
  [PaymentStatus.FAILED]: {
    label: "Failed",
    color: "text-red-600 bg-red-50",
    icon: "XCircle",
  },
  [PaymentStatus.REFUNDED]: {
    label: "Refunded",
    color: "text-slate-600 bg-slate-50",
    icon: "RefreshCcw",
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: APP_CONFIG.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function generateVoucherCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomPart = Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  const year = new Date().getFullYear();
  return `KSP-${year}-${randomPart}`;
}

export function getServicesByCategory(category: ServiceCategory): Service[] {
  return SERVICES.filter((service) => service.category === category);
}

export function getServiceById(id: string): Service | undefined {
  return SERVICES.find((service) => service.id === id);
}
