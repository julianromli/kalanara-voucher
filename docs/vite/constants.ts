
import { Service, Transaction, VoucherStatus, Review } from './types';

export const MOCK_SERVICES: Service[] = [
  {
    id: 'srv_001',
    title: 'Royal Javanese Massage',
    description: 'A holistic treatment using traditional techniques to relieve muscle tension and improve blood circulation.',
    durationMin: 90,
    price: 450000,
    image: 'https://picsum.photos/800/600?random=2',
    facilities: ['Welcome Drink', 'Foot Bath', 'Shower', 'Ginger Tea']
  },
  {
    id: 'srv_002',
    title: 'Zen Harmony Couple Package',
    description: 'A romantic getaway for two. Includes full body massage, scrub, and a flower bath.',
    durationMin: 120,
    price: 850000,
    image: 'https://picsum.photos/800/600?random=2',
    facilities: ['Private Suite', 'Rose Petal Bath', 'Body Scrub', 'Snack Platter']
  },
  {
    id: 'srv_003',
    title: 'Deep Tissue Restoration',
    description: 'Intense massage targeting deep muscle layers to release chronic tension.',
    durationMin: 60,
    price: 350000,
    image: 'https://picsum.photos/800/600?random=3',
    facilities: ['Consultation', 'Mineral Water', 'Hot Towel']
  },
  {
    id: 'srv_004',
    title: 'Radiant Glow Facial',
    description: 'Rejuvenate your skin with organic ingredients and gentle acupressure.',
    durationMin: 75,
    price: 400000,
    image: 'https://picsum.photos/800/600?random=4',
    facilities: ['Skin Analysis', 'Head Massage', 'Organic Serum']
  }
];

// Initial mock transactions for the Admin Dashboard
export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'KAL-2025-A1B2',
    serviceId: 'srv_001',
    customer: { 
      name: 'Siti Rahma', 
      email: 'siti@example.com',
      phone: '08123456789' 
    },
    purchaseDate: '2024-05-01',
    expiryDate: '2024-11-01',
    status: VoucherStatus.ACTIVE,
    amount: 450000,
    paymentMethod: 'QRIS'
  },
  {
    id: 'KAL-2025-C3D4',
    serviceId: 'srv_002',
    customer: { 
      name: 'Budi Santoso', 
      email: 'budi@example.com',
      phone: '08198765432' 
    },
    purchaseDate: '2024-04-20',
    expiryDate: '2024-10-20',
    status: VoucherStatus.REDEEMED,
    amount: 850000,
    paymentMethod: 'CREDIT_CARD'
  },
  {
    id: 'KAL-2025-E5F6',
    serviceId: 'srv_003',
    customer: { 
      name: 'Jessica Lee', 
      email: 'jessica@example.com',
      phone: '08188899900' 
    },
    purchaseDate: '2023-12-01',
    expiryDate: '2024-06-01',
    status: VoucherStatus.EXPIRED,
    amount: 350000,
    paymentMethod: 'BANK_TRANSFER'
  }
];

export const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev_1',
    transactionId: 'KAL-2025-C3D4',
    customerName: 'Budi Santoso',
    serviceTitle: 'Zen Harmony Couple Package',
    rating: 5,
    comment: 'Absolutely magical experience. The flower bath was stunning!',
    date: '2024-04-22'
  },
  {
    id: 'rev_2',
    transactionId: 'KAL-MOCK-OLD',
    customerName: 'Sarah Jenkins',
    serviceTitle: 'Royal Javanese Massage',
    rating: 4,
    comment: 'Very professional therapists. The ginger tea afterwards was a nice touch.',
    date: '2024-03-15'
  },
  {
    id: 'rev_3',
    transactionId: 'KAL-MOCK-OLD2',
    customerName: 'Anita W.',
    serviceTitle: 'Radiant Glow Facial',
    rating: 5,
    comment: 'My skin felt so fresh for days. Highly recommend.',
    date: '2024-02-10'
  }
];

export const APP_NAME = "Kalanara Spa";
export const CONTACT_WA = "+62 812-3456-7890";
