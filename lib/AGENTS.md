# Lib Directory

## Purpose
Shared utilities, TypeScript types, Server Actions, and Supabase client configuration.

## Structure
```
lib/
├── types.ts           # All TypeScript types & enums
├── constants.ts       # App config, service data, formatters
├── utils.ts           # Generic utilities (cn for classnames)
├── database.types.ts  # Supabase generated types
├── pdf.ts             # PDF voucher generation
├── actions/           # Server Actions (Supabase queries)
│   ├── vouchers.ts    # Voucher CRUD
│   ├── orders.ts      # Order management
│   ├── services.ts    # Service queries
│   └── reviews.ts     # Review operations
├── supabase/          # Supabase client setup
│   ├── client.ts      # Browser client (anon key)
│   └── server.ts      # Server client (service role)
└── utils/             # Feature-specific utilities
    └── whatsapp.ts    # WhatsApp URL generation
```

## Types (`types.ts`)

### Key Enums
```typescript
enum ServiceCategory { MASSAGE, FACIAL, BODY_TREATMENT, PACKAGE }
enum PaymentMethod { CREDIT_CARD, BANK_TRANSFER, E_WALLET }
enum PaymentStatus { PENDING, COMPLETED, FAILED, REFUNDED }
enum DeliveryMethod { EMAIL, WHATSAPP, BOTH }
enum SendTo { PURCHASER, RECIPIENT }
enum AdminRole { SUPER_ADMIN, MANAGER, STAFF }
```

### Key Interfaces
- `Service` - Spa service definition
- `Voucher` - Gift voucher with code, recipient, expiry
- `Order` - Purchase order linking voucher + payment
- `DeliveryOptions` - sendTo, deliveryMethod, recipientPhone

### Adding Types
1. Add to appropriate section (Enums, Interfaces, Utility Types)
2. Follow existing JSDoc pattern
3. Use `readonly` for immutable properties

## Server Actions (`actions/`)

### Pattern
```typescript
// lib/actions/feature.ts
"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function createFeature(data: CreateInput) {
  const supabase = await createServerClient();
  const { data: result, error } = await supabase
    .from("table_name")
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  return result;
}
```

### Existing Actions
| File | Functions |
|------|-----------|
| `vouchers.ts` | `createVoucher`, `getVoucherByCode`, `redeemVoucher`, `getVouchers` |
| `orders.ts` | `createOrder`, `getOrders` |
| `services.ts` | `getServices`, `createService`, `updateService` |
| `reviews.ts` | `createReview`, `getReviewByVoucherId` |

## Supabase Clients

### Browser Client (`client.ts`)
```typescript
import { createBrowserClient } from "@/lib/supabase/client";
// Use in client components, uses anon key
```

### Server Client (`server.ts`)
```typescript
import { createServerClient } from "@/lib/supabase/server";
// Use in Server Actions/API routes, can use service role
```

## Constants (`constants.ts`)

### APP_CONFIG
```typescript
APP_CONFIG.voucherValidity  // 180 days
APP_CONFIG.currency         // "IDR"
```

### Formatters
```typescript
formatCurrency(450000)  // "Rp 450.000"
formatDate(date)        // "28 Nov 2025"
```

### Mock Services
`MOCK_SERVICES` array - fallback data if Supabase fails

## Utilities

### `utils.ts`
```typescript
cn(...classes)  // Tailwind class merger
```

### `utils/whatsapp.ts`
```typescript
formatPhoneNumber(phone)     // Normalize to +62 format
generateWhatsAppUrl(data)    // wa.me URL with message
generateVoucherMessage(data) // Formatted voucher message
```

### `pdf.ts`
```typescript
generateVoucherPDF(voucher)  // Returns jspdf document
```

## JIT Index
```bash
# Find type definition
rg -n "export (interface|type|enum) Name" lib/types.ts

# Find server action
rg -n "export async function" lib/actions/

# Find Supabase table query
rg -n "\.from\(['\"]tablename" lib/

# Find constant
rg -n "export const" lib/constants.ts
```

## Common Gotchas
- Server Actions MUST have `"use server"` at top
- Use `createServerClient()` for admin operations (service role key)
- Database types in `database.types.ts` are auto-generated - don't edit manually
- Always handle Supabase errors: `if (error) throw error`
