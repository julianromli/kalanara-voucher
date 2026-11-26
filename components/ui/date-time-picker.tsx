"use client";

import { DatePicker, formatISODate, parseISODate } from "@/components/ui/date-picker";
import { parseTime, TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

export type DateTimePickerProps = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  min?: Date;
  max?: Date;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  clearable?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/** Parse a local `YYYY-MM-DDTHH:mm` value, or a full ISO timestamp. */
export function parseDateTimeLocal(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const local = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (local) {
    const date = new Date(
      Number(local[1]),
      Number(local[2]) - 1,
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
      Number(local[6] ?? 0),
    );
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Format a date as a local `YYYY-MM-DDTHH:mm` string. */
export function formatDateTimeLocal(date: Date): string {
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${formatISODate(date)}T${time}`;
}

export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled = false,
  id,
  name,
  required = false,
  clearable,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: DateTimePickerProps) {
  const dateValue = value
    ? parseISODate(formatISODate(value))
    : undefined;
  const timeValue = value
    ? `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <DatePicker
        value={dateValue}
        onChange={(date) => {
          if (!date) {
            onChange(undefined);
            return;
          }
          const time = parseTime(timeValue) || "00:00";
          const [hours, minutes] = time.split(":").map(Number);
          onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes));
        }}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        required={required}
        clearable={clearable}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className="min-w-0 flex-1"
      />
      <TimePicker
        value={timeValue}
        onChange={(time) => {
          if (!dateValue) return;
          const parsed = parseTime(time);
          if (!parsed) return;
          const [hours, minutes] = parsed.split(":").map(Number);
          onChange(
            new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate(), hours, minutes),
          );
        }}
        disabled={disabled || !dateValue}
        required={required}
        name={name}
        className="sm:w-[11rem]"
        aria-label="Waktu"
      />
    </div>
  );
}
