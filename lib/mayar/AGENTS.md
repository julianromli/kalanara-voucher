# Mayar Payment Gateway Module

## Purpose
HTTP client and types for Mayar.id payment gateway integration.

## Files
- `config.ts` - Environment-aware config (sandbox vs production)
- `types.ts` - Request/response types, webhook payload types, type guards
- `client.ts` - `createMayarPayment()` API call

## Critical Quirks

### Sandbox vs Production Behavior
- Sandbox returns `transactionStatus: "created"` instead of `"paid"`.
- Sandbox overwrites `description` field with "Penagihan", breaking Order ID extraction from description.
- **Fix:** Order ID extraction must fallback to `customerName` or `transactionId` lookup.

### Order ID Extraction
Mayar webhook doesn't include a custom order ID field. Order ID must be embedded in `description`:
```typescript
description: `Voucher Spa - ${serviceName} | Order: ${orderId}`
```
Webhook extracts via regex: `/Order:\s*(KSP-[\w-]+)/i`

### Environment URLs
| Environment | Dashboard | API |
|-------------|-----------|-----|
| Sandbox | `web.mayar.club` | `api.mayar.club` |
| Production | `web.mayar.id` | `api.mayar.id` |

### Webhook Registration
Must register webhook URL via API call (not dashboard UI):
```bash
curl -X POST 'https://api.mayar.{club|id}/hl/v1/webhook/register' \
  -H 'Authorization: Bearer API_KEY' \
  -d '{"url": "https://domain/api/mayar/webhook"}'
```

## Related Files
- `app/api/mayar/create-payment/route.ts` - Creates pending order + payment link
- `app/api/mayar/webhook/route.ts` - Processes payment notifications
- `lib/payment/voucher-service.ts` - Called by webhook to create voucher
- `lib/actions/orders.ts` - `createPendingOrder`, `updateOrderPaymentStatus`
