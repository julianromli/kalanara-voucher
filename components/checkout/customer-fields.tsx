import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { User } from "lucide-react";
import { Input } from "@/components/ui/input";

interface CustomerFieldsProps {
  idPrefix: string;
  nameRegistration: UseFormRegisterReturn;
  emailRegistration: UseFormRegisterReturn;
  phoneRegistration: UseFormRegisterReturn;
  errors: {
    name?: FieldError;
    email?: FieldError;
    phone?: FieldError;
  };
  description?: string;
  className?: string;
}

function FieldErrorMessage({
  id,
  error,
}: {
  id: string;
  error?: FieldError;
}) {
  return error ? (
    <p id={id} className="mt-1 text-xs text-destructive" role="alert">
      {error.message}
    </p>
  ) : null;
}

export function CustomerFields({
  idPrefix,
  nameRegistration,
  emailRegistration,
  phoneRegistration,
  errors,
  description,
  className = "",
}: CustomerFieldsProps) {
  const fields = [
    {
      key: "name",
      label: "Nama Lengkap",
      type: "text",
      placeholder: "Nama kamu",
      registration: nameRegistration,
      error: errors.name,
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      placeholder: "nama@email.com",
      registration: emailRegistration,
      error: errors.email,
    },
    {
      key: "phone",
      label: "WhatsApp",
      type: "text",
      placeholder: "+62 812 3456 7890",
      registration: phoneRegistration,
      error: errors.phone,
    },
  ] as const;

  return (
    <section
      className={`${className} rounded-2xl border border-border bg-card p-4 sm:p-6`}
    >
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
        <User size={20} aria-hidden="true" /> Data pembeli
      </h2>
      {description ? (
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="space-y-4">
        {fields.map((field) => {
          const id = `${idPrefix}-customer-${field.key}`;
          const errorId = `${id}-error`;
          return (
            <div key={field.key}>
              <label
                htmlFor={id}
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                {field.label}
              </label>
              <Input
                id={id}
                {...field.registration}
                type={field.type}
                placeholder={field.placeholder}
                className={field.error ? "border-destructive" : ""}
                aria-invalid={Boolean(field.error)}
                aria-describedby={field.error ? errorId : undefined}
              />
              <FieldErrorMessage id={errorId} error={field.error} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
