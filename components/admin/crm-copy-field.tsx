"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CrmCopyFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}

export function CrmCopyField({
  id,
  label,
  hint,
  value,
  onChange,
  maxLength,
  multiline = false,
  placeholder,
  type = "text",
  disabled = false,
}: CrmCopyFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const counterId = maxLength ? `${id}-counter` : undefined;
  const describedBy = [hintId, counterId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {maxLength ? (
          <span
            id={counterId}
            className="text-xs tabular-nums text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-pretty text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          aria-describedby={describedBy}
          className="min-h-24"
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          aria-describedby={describedBy}
        />
      )}
    </div>
  );
}
