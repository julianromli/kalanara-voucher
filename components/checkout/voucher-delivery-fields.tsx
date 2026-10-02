"use client";

import { useState } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { getDeliveryPreview } from "@/lib/checkout/client";
import { DeliveryMethod, SendTo } from "@/lib/types";

interface VoucherDeliveryFieldsProps {
  idPrefix: string;
  sendTo: SendTo;
  deliveryMethod: DeliveryMethod;
  senderMessage: string;
  registerSendTo: () => UseFormRegisterReturn;
  recipientNameRegistration: UseFormRegisterReturn;
  recipientNameError?: FieldError;
  senderMessageRegistration: UseFormRegisterReturn;
  recipientPhoneRegistration: UseFormRegisterReturn;
  recipientPhoneError?: FieldError;
  recipientEmailRegistration: UseFormRegisterReturn;
  recipientEmailError?: FieldError;
  showRecipientPhone: boolean;
  showRecipientEmail: boolean;
  onIncludeEmailChange: (includeEmail: boolean) => void;
}

function FieldErrorMessage({ id, error }: { id: string; error?: FieldError }) {
  return error ? (
    <p id={id} className="mt-1 text-xs text-destructive" role="alert">
      {error.message}
    </p>
  ) : null;
}

export function VoucherDeliveryFields({
  idPrefix,
  sendTo,
  deliveryMethod,
  senderMessage,
  registerSendTo,
  recipientNameRegistration,
  recipientNameError,
  senderMessageRegistration,
  recipientPhoneRegistration,
  recipientPhoneError,
  recipientEmailRegistration,
  recipientEmailError,
  showRecipientPhone,
  showRecipientEmail,
  onIncludeEmailChange,
}: VoucherDeliveryFieldsProps) {
  const [messageOpen, setMessageOpen] = useState(Boolean(senderMessage.trim()));
  const forSelf = sendTo === SendTo.PURCHASER;
  const includeEmail =
    deliveryMethod === DeliveryMethod.EMAIL ||
    deliveryMethod === DeliveryMethod.BOTH;
  const recipientNameId = `${idPrefix}-recipient-name`;
  const recipientNameHelpId = `${recipientNameId}-help`;
  const recipientNameErrorId = `${recipientNameId}-error`;
  const senderMessageId = `${idPrefix}-sender-message`;
  const recipientPhoneId = `${idPrefix}-recipient-phone`;
  const recipientPhoneErrorId = `${recipientPhoneId}-error`;
  const recipientEmailId = `${idPrefix}-recipient-email`;
  const recipientEmailErrorId = `${recipientEmailId}-error`;
  const sendToLabelId = `${idPrefix}-send-to-label`;
  const includeEmailId = `${idPrefix}-include-email`;

  return (
    <div className="grid gap-4">
      <div>
        <p
          id={sendToLabelId}
          className="mb-2 text-sm font-medium text-muted-foreground"
        >
          Voucher ini untuk siapa?
        </p>
        <div
          role="radiogroup"
          aria-labelledby={sendToLabelId}
          className="grid grid-cols-2 gap-3"
        >
          {[
            { value: SendTo.PURCHASER, label: "Untuk saya" },
            { value: SendTo.RECIPIENT, label: "Untuk orang lain" },
          ].map((option) => {
            const radioId = `${idPrefix}-send-to-${option.value}`;
            return (
              <label
                key={option.value}
                htmlFor={radioId}
                className={`flex min-h-14 cursor-pointer items-center justify-center rounded-xl border px-3 text-center text-sm transition-[color,background-color,border-color] focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:text-base ${
                  sendTo === option.value
                    ? "border-primary bg-muted font-medium text-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                <input
                  id={radioId}
                  type="radio"
                  value={option.value}
                  {...registerSendTo()}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor={recipientNameId}
          className="mb-2 block text-sm font-medium text-muted-foreground"
        >
          {forSelf ? "Nama di voucher" : "Nama penerima"}
        </label>
        <Input
          id={recipientNameId}
          {...recipientNameRegistration}
          placeholder="Nama penerima voucher"
          className={recipientNameError ? "border-destructive" : ""}
          aria-invalid={Boolean(recipientNameError)}
          aria-describedby={
            recipientNameError
              ? `${recipientNameHelpId} ${recipientNameErrorId}`
              : recipientNameHelpId
          }
        />
        <p id={recipientNameHelpId} className="mt-1 text-xs text-muted-foreground">
          {forSelf
            ? "Kosongkan jika sama dengan nama kamu."
            : "Nama ini akan tercetak di voucher."}
        </p>
        <FieldErrorMessage id={recipientNameErrorId} error={recipientNameError} />
      </div>

      <div>
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          aria-expanded={messageOpen}
          aria-controls={messageOpen ? senderMessageId : undefined}
          onClick={() => setMessageOpen((open) => !open)}
        >
          {messageOpen ? "Tutup ucapan" : "Tambah ucapan"}
        </button>
        {messageOpen ? (
          <div className="mt-2">
            <label
              htmlFor={senderMessageId}
              className="mb-2 block text-sm font-medium text-muted-foreground"
            >
              Pesan untuk penerima
            </label>
            <textarea
              id={senderMessageId}
              {...senderMessageRegistration}
              rows={2}
              placeholder="Tulis pesan singkat jika mau"
              className="min-h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ) : null}
      </div>

      <label
        htmlFor={includeEmailId}
        className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 text-sm text-foreground"
      >
        <input
          id={includeEmailId}
          type="checkbox"
          checked={includeEmail}
          onChange={(event) => onIncludeEmailChange(event.target.checked)}
        />
        Kirim juga lewat email
      </label>

      <p className="text-sm text-foreground">{getDeliveryPreview(sendTo, deliveryMethod)}</p>

      {showRecipientPhone ? (
        <div>
          <label
            htmlFor={recipientPhoneId}
            className="mb-2 block text-sm font-medium text-muted-foreground"
          >
            WhatsApp penerima
          </label>
          <Input
            id={recipientPhoneId}
            {...recipientPhoneRegistration}
            placeholder="+62 812 3456 7890"
            className={recipientPhoneError ? "border-destructive" : ""}
            aria-invalid={Boolean(recipientPhoneError)}
            aria-describedby={
              recipientPhoneError ? recipientPhoneErrorId : undefined
            }
          />
          <FieldErrorMessage id={recipientPhoneErrorId} error={recipientPhoneError} />
        </div>
      ) : null}

      {showRecipientEmail ? (
        <div>
          <label
            htmlFor={recipientEmailId}
            className="mb-2 block text-sm font-medium text-muted-foreground"
          >
            Email penerima
          </label>
          <Input
            id={recipientEmailId}
            {...recipientEmailRegistration}
            type="email"
            placeholder="penerima@email.com"
            className={recipientEmailError ? "border-destructive" : ""}
            aria-invalid={Boolean(recipientEmailError)}
            aria-describedby={
              recipientEmailError ? recipientEmailErrorId : undefined
            }
          />
          <FieldErrorMessage id={recipientEmailErrorId} error={recipientEmailError} />
        </div>
      ) : null}
    </div>
  );
}
