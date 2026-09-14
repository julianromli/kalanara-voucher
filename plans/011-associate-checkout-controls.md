# 011 — Associate and visibly focus checkout controls

- **Status**: OPEN
- **Commit**: b94c4ae
- **Severity**: HIGH
- **Category**: Accessibility
- **Rule**: react-doctor/label-has-associated-control
- **Estimated scope**: 2 files, repetitive form markup changes

## Problem

Both checkout clients contain visible sibling labels without `htmlFor` and controls without matching IDs:

```tsx
// app/checkout/[id]/checkout-page-client.tsx:575-604 — current
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Nama Penerima
                    </label>
                    <Input
                      {...register("recipientName", {
                        required: "Nama penerima wajib diisi",
                      })}
                      placeholder="Nama penerima voucher"
                      className={errors.recipientName ? "border-destructive" : ""}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nama ini akan tercetak di voucher.
                    </p>
                    {errors.recipientName ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.recipientName.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Pesan untuk Penerima
                    </label>
                    <textarea
                      {...register("senderMessage")}
                      rows={3}
                      placeholder="Tulis pesan singkat jika mau"
                      className="min-h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
```

```tsx
// app/checkout/[id]/checkout-page-client.tsx:685-735 — current
                  {showRecipientPhone ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-muted-foreground">
                        WhatsApp Penerima
                      </label>
                      <Input
                        {...registerPhoneField("recipientPhone")}
                        placeholder="+62 812 3456 7890"
                        className={errors.recipientPhone ? "border-destructive" : ""}
                        aria-invalid={Boolean(errors.recipientPhone)}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Gunakan format 08xxxxxxxx atau +62xxxxxxxx
                      </p>
                      {errors.recipientPhone ? (
                        <p className="mt-1 text-xs text-destructive" role="alert">
                          {errors.recipientPhone.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {showRecipientEmail ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-muted-foreground">
                        Email Penerima
                      </label>
                      <Input
                        {...register("recipientEmail", {
                          required: showRecipientEmail
                            ? "Email penerima wajib diisi"
                            : false,
                          pattern: showRecipientEmail
                            ? {
                                value: /^\S+@\S+$/i,
                                message: "Format email tidak valid",
                              }
                            : undefined,
                          setValueAs: (value: unknown) =>
                            typeof value === "string" ? value.trim() : value,
                        })}
                        type="email"
                        placeholder="penerima@email.com"
                        className={errors.recipientEmail ? "border-destructive" : ""}
                        aria-invalid={Boolean(errors.recipientEmail)}
                      />
```

```tsx
// app/checkout/[id]/checkout-page-client.tsx:750-800 — current
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Nama Lengkap
                    </label>
                    <Input
                      {...register("customerName", {
                        required: "Nama lengkap wajib diisi",
                        setValueAs: (value: unknown) =>
                          typeof value === "string" ? value.trim() : value,
                      })}
                      placeholder="Nama kamu"
                      className={errors.customerName ? "border-destructive" : ""}
                    />
                    {errors.customerName ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerName.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Email
                    </label>
                    <Input
                      {...register("customerEmail", {
                        required: "Email wajib diisi",
                        pattern: {
                          value: /^\S+@\S+$/i,
                          message: "Format email tidak valid",
                        },
                        setValueAs: (value: unknown) =>
                          typeof value === "string" ? value.trim() : value,
                      })}
                      type="email"
                      placeholder="nama@email.com"
                      className={errors.customerEmail ? "border-destructive" : ""}
                    />
                    {errors.customerEmail ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerEmail.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      WhatsApp
                    </label>
                    <Input
                      {...registerPhoneField("customerPhone")}
                      placeholder="+62 812 3456 7890"
                      className={errors.customerPhone ? "border-destructive" : ""}
                    />
```

```tsx
// app/checkout/[id]/checkout-page-client.tsx:885-896 — current
                    {paymentMethod === "va" && selectedPaymentOption?.subMethods?.length ? (
                      <div className="mt-4 space-y-2">
                        <label className="block text-sm font-medium text-muted-foreground">
                          Bank Virtual Account
                        </label>
                        <select
                          value={subPaymentMethod}
                          onChange={(event) =>
                            setSubPaymentMethod(event.target.value as ScalevVABankCode)
                          }
                          className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"
```

Cart checkout repeats the same defects:

```tsx
// app/checkout/cart/cart-checkout-client.tsx:586-639 — current
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Nama Lengkap
                    </label>
                    <Input
                      {...register("customerName", {
                        required: "Nama lengkap wajib diisi",
                        setValueAs: (value: unknown) =>
                          typeof value === "string" ? value.trim() : value,
                      })}
                      placeholder="Nama kamu"
                      className={errors.customerName ? "border-destructive" : ""}
                    />
                    {errors.customerName ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerName.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Email
                    </label>
                    <Input
                      {...register("customerEmail", {
                        required: "Email wajib diisi",
                        pattern: {
                          value: /^\S+@\S+$/i,
                          message: "Format email tidak valid",
                        },
                        setValueAs: (value: unknown) =>
                          typeof value === "string" ? value.trim() : value,
                      })}
                      type="email"
                      placeholder="nama@email.com"
                      className={errors.customerEmail ? "border-destructive" : ""}
                    />
                    {errors.customerEmail ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerEmail.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      WhatsApp
                    </label>
                    <Input
                      {...registerPhoneField("customerPhone", "Nomor WhatsApp wajib diisi")}
                      placeholder="+62 812 3456 7890"
                      className={errors.customerPhone ? "border-destructive" : ""}
```

```tsx
// app/checkout/cart/cart-checkout-client.tsx:802-830 — current
                          <div className="mt-5 grid gap-4">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                                Nama Penerima
                              </label>
                              <Input
                                {...register(`lineItems.${index}.recipientName`, {
                                  required: "Nama penerima wajib diisi",
                                })}
                                placeholder="Nama penerima voucher"
                                className={itemErrors?.recipientName ? "border-destructive" : ""}
                              />
                              {itemErrors?.recipientName ? (
                                <p className="mt-1 text-xs text-destructive" role="alert">
                                  {itemErrors.recipientName.message}
                                </p>
                              ) : null}
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                                Pesan untuk Penerima
                              </label>
                              <textarea
                                {...register(`lineItems.${index}.senderMessage`)}
                                rows={2}
                                placeholder="Tulis pesan singkat jika mau"
                                className="min-h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                              />
```

```tsx
// app/checkout/cart/cart-checkout-client.tsx:896-934 — current
                            {showRecipientPhone ? (
                              <div>
                                <label className="mb-2 block text-sm font-medium text-muted-foreground">
                                  WhatsApp Penerima
                                </label>
                                <Input
                                  {...registerPhoneField(
                                    `lineItems.${index}.recipientPhone`,
                                    "Nomor WhatsApp penerima wajib diisi"
                                  )}
                                  placeholder="+62 812 3456 7890"
                                  className={itemErrors?.recipientPhone ? "border-destructive" : ""}
                                />
                                {itemErrors?.recipientPhone ? (
                                  <p className="mt-1 text-xs text-destructive" role="alert">
                                    {itemErrors.recipientPhone.message}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            {showRecipientEmail ? (
                              <div>
                                <label className="mb-2 block text-sm font-medium text-muted-foreground">
                                  Email Penerima
                                </label>
                                <Input
                                  {...register(`lineItems.${index}.recipientEmail`, {
                                    required: "Email penerima wajib diisi",
                                    pattern: {
                                      value: /^\S+@\S+$/i,
                                      message: "Format email tidak valid",
                                    },
```

```tsx
// app/checkout/cart/cart-checkout-client.tsx:1023-1034 — current
                    {paymentMethod === "va" && selectedPaymentOption?.subMethods?.length ? (
                      <div className="mt-4 space-y-2">
                        <label className="block text-sm font-medium text-muted-foreground">
                          Bank Virtual Account
                        </label>
                        <select
                          value={subPaymentMethod}
                          onChange={(event) =>
                            setSubPaymentMethod(event.target.value as ScalevVABankCode)
                          }
                          className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"
```

Wrapped `sr-only` radio cards are associated structurally but have no visible focus:

```tsx
// app/checkout/[id]/checkout-page-client.tsx:615-631 — current
                        <label
                          key={option.value}
                          className={`flex min-h-14 cursor-pointer items-center justify-center rounded-xl border p-3 text-center text-sm transition-all sm:text-base ${
                            sendTo === option.value
                              ? "border-primary bg-muted font-medium text-foreground"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          <input
                            type="radio"
                            value={option.value}
                            {...register("sendTo", { required: true })}
                            className="sr-only"
                          />
                          {option.label}
                        </label>
```

## Target

Canonical recipe (verbatim):

> Either wrap the control inside the label (`<label>Surname <input type='text' /></label>`) or use htmlFor with a matching id (`<label htmlFor='surname'>Surname</label><input id='surname' />`). Ensure the label has visible text. For custom components, configure labelComponents/controlComponents/labelAttributes in the rule options. See https://oxc.rs/docs/guide/usage/linter/rules/jsx_a11y/label-has-associated-control

Use stable sibling associations, visible text, unchanged names/focus/order, and programmatic errors:

```tsx
// app/checkout/[id]/checkout-page-client.tsx — target pattern
<label htmlFor="checkout-recipient-name" className="mb-2 block text-sm font-medium text-muted-foreground">
  Nama Penerima
</label>
<Input
  id="checkout-recipient-name"
  {...register("recipientName", { required: "Nama penerima wajib diisi" })}
  aria-invalid={Boolean(errors.recipientName)}
  aria-describedby={[
    "checkout-recipient-name-help",
    errors.recipientName ? "checkout-recipient-name-error" : null,
  ].filter(Boolean).join(" ")}
/>
<p id="checkout-recipient-name-help">Nama ini akan tercetak di voucher.</p>
{errors.recipientName ? (
  <p id="checkout-recipient-name-error" role="alert">
    {errors.recipientName.message}
  </p>
) : null}
```

Static IDs: `checkout-recipient-name`, `checkout-sender-message`, `checkout-recipient-phone`, `checkout-recipient-email`, `checkout-customer-name`, `checkout-customer-email`, `checkout-customer-phone`, `checkout-va-bank`; cart equivalents use `cart-customer-*` and `cart-va-bank`. Help/error IDs append `-help`/`-error`.

Repeated cart IDs derive from stable `field.id`, never `index`:

```tsx
// app/checkout/cart/cart-checkout-client.tsx — target pattern
const fieldIdPrefix = `cart-voucher-${field.id}`;
const recipientNameId = `${fieldIdPrefix}-recipient-name`;
const recipientNameErrorId = `${recipientNameId}-error`;

<label htmlFor={recipientNameId}>Nama Penerima</label>
<Input
  id={recipientNameId}
  {...register(`lineItems.${index}.recipientName`, {
    required: "Nama penerima wajib diisi",
  })}
  aria-invalid={Boolean(itemErrors?.recipientName)}
  aria-describedby={itemErrors?.recipientName ? recipientNameErrorId : undefined}
/>
{itemErrors?.recipientName ? (
  <p id={recipientNameErrorId} role="alert">
    {itemErrors.recipientName.message}
  </p>
) : null}
```

Use `${fieldIdPrefix}-sender-message`, `-recipient-phone`, and `-recipient-email`. Give radios stable IDs and matching `htmlFor`; preserve names. For hidden radios:

```tsx
// target visible-focus radio card
<label
  htmlFor={radioId}
  className="... focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
>
  <input
    id={radioId}
    type="radio"
    {...register(fieldName, { required: true })}
    className="sr-only"
  />
  {visibleLabel}
</label>
```

Use `checkout-send-to-${option.value}`, `checkout-delivery-${method.value}`, `checkout-payment-${option.code}`, and stable cart/`field.id` equivalents.

## Repo conventions to follow

- Keep native semantics and the existing `Input` primitive.
- Imitate `components/admin/vouchers-client.tsx:110` (`EXTEND_DAYS_SELECT_ID`).
- Preserve React Hook Form registration, validation strings, conditional rendering, and invalid-submit focus.

## Steps

1. Associate every static field at single-checkout lines 575–793 and VA select line 887.
2. Associate cart purchaser lines 586–629, repeated fields lines 804–919, and VA select line 1025.
3. Add `aria-invalid`, stable help/error IDs, and `aria-describedby`.
4. Derive repeated IDs from `field.id`.
5. Add radio IDs/matching labels without changing names/order; add `focus-within` ring to all `sr-only` radio cards.
6. Add tests for label resolution, unique IDs, descriptions, and keyboard interaction.
7. Re-read the diff and remove unrelated churn.

## Boundaries

- Do NOT rename field/radio names, reorder controls, alter validation, or change submit behavior.
- Do NOT replace visible labels with `aria-label`.
- Do NOT use indexes/random values for repeated IDs.
- Do NOT expose hidden radios; style card focus via `focus-within`.
- Do NOT add dependencies or disable the rule.
- STOP on drift from `b94c4ae`; report it.

## Verification

- **Mechanical**:
  - Run `npx react-doctor@latest --scope changed`; targeted diagnostics clear and score does not regress, then run an unfiltered affected-scope scan.
  - Run `bunx tsc --noEmit`, `bun run lint`, focused accessibility tests, and a rendered accessibility audit for orphan labels/duplicate IDs/broken descriptions.
- **Behavior check**:
  - Click every visible label in both routes, including two cart items; only its control focuses.
  - Trigger errors and inspect the accessibility tree for visible name, invalid state, and correct help/error descriptions.
  - Keyboard through radios; focus ring, arrow/Space behavior, names, and order remain correct.
  - Profile focus/selection and use “Highlight updates”; associations must add no state commits or unrelated flashes.
- **Done when**: all visible labels resolve deterministically, errors are described, hidden-radio focus is visible, names/focus/order are preserved, and checks pass.
