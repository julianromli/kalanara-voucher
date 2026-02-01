# Mayar.id Payment Gateway Setup

## Overview

Kalanara Spa uses Mayar.id as the payment gateway for processing voucher purchases.
Mayar provides a redirect-based payment flow where customers are redirected to
Mayar's payment page to complete the transaction.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MAYAR_API_KEY` | API key from Mayar dashboard (server-side only) | `myr_xxx...` |
| `MAYAR_IS_PRODUCTION` | Environment mode | `false` for sandbox |

### Getting API Keys

1. **Sandbox (Testing)**
   - Go to https://web.mayar.club
   - Register or login
   - Navigate to API Keys: https://web.mayar.club/api-keys
   - Generate a new API key

2. **Production**
   - Go to https://web.mayar.id
   - Login to your merchant account
   - Navigate to API Keys: https://web.mayar.id/api-keys
   - Generate a new API key

## Webhook Configuration

### Webhook URL

Register the following URL as your webhook endpoint:

- **Development**: `https://your-ngrok-url.ngrok.io/api/mayar/webhook`
- **Production**: `https://your-domain.com/api/mayar/webhook`

### Registering Webhook

Use the Mayar API to register your webhook URL:

```bash
# For sandbox
curl --request POST 'https://api.mayar.club/hl/v1/webhook/register' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "url": "https://your-domain.com/api/mayar/webhook"
  }'

# For production
curl --request POST 'https://api.mayar.id/hl/v1/webhook/register' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "url": "https://your-domain.com/api/mayar/webhook"
  }'
```

### Webhook Events

The webhook handler processes these events:
- `payment.received` - Payment successful (triggers voucher creation)
- `payment.reminder` - Payment reminder (ignored)

## Payment Flow

```
1. Customer fills checkout form
2. Backend creates pending order in database
3. Backend calls Mayar API to create payment request
4. Customer is redirected to Mayar payment page
5. Customer completes payment
6. Mayar redirects customer back to success page
7. Mayar sends webhook notification
8. Backend creates voucher and sends delivery (email/WhatsApp)
```

## File Structure

```
lib/mayar/
├── config.ts       # Environment-aware configuration
├── types.ts        # TypeScript types for Mayar API
└── client.ts       # HTTP client for Mayar API

lib/payment/
└── voucher-service.ts  # Voucher creation on payment success

app/api/mayar/
├── create-payment/route.ts  # Creates pending order + payment link
└── webhook/route.ts         # Handles payment notifications
```

## Testing

### Local Development Setup

1. Set environment variables in `.env.local`:
   ```env
   MAYAR_API_KEY=your-sandbox-api-key
   MAYAR_IS_PRODUCTION=false
   ```

2. Use ngrok to expose localhost for webhook testing:
   ```bash
   ngrok http 3000
   ```

3. Register ngrok URL as webhook (see above)

4. Start dev server:
   ```bash
   bun run dev
   ```

5. Complete test payment on sandbox

### Test Payment Methods

Mayar sandbox accepts various test payment methods. Check Mayar documentation
for available test credentials at https://docs.mayar.id

## Troubleshooting

### Common Issues

1. **"Layanan pembayaran tidak tersedia"**
   - Check `MAYAR_API_KEY` is set correctly in `.env.local`
   - Verify API key is valid and not expired
   - Ensure using correct API key for environment (sandbox vs production)

2. **Webhook not received**
   - Verify webhook URL is registered with Mayar
   - Check ngrok is running (for development)
   - Check server logs for errors: `bun run dev`
   - Verify the webhook URL is accessible from the internet

3. **Voucher not created after payment**
   - Check webhook logs for errors
   - Verify order ID extraction from description works
   - Check database for order status (should be COMPLETED)
   - Verify email/WhatsApp credentials are configured

4. **Payment link expired**
   - Default expiry is 24 hours
   - Customer needs to restart checkout

## Database Schema

Orders table columns for payment tracking:

| Column | Description |
|--------|-------------|
| `payment_order_id` | Unique order ID sent to Mayar (format: `KSP-{timestamp}-{random}`) |
| `payment_transaction_id` | Transaction ID returned by Mayar |
| `payment_type` | Payment method used (e.g., qris, bank_transfer) |
| `payment_transaction_time` | Timestamp of payment |
| `payment_link` | Payment URL for customer redirect |
| `payment_status` | Order status: PENDING, COMPLETED, FAILED, REFUNDED |

## API Reference

- [Mayar API Introduction](https://docs.mayar.id/api-reference/introduction)
- [Create Payment](https://docs.mayar.id/api-reference/reqpayment/create)
- [Webhook](https://docs.mayar.id/api-reference/webhook/history)
