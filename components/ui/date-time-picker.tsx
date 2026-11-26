"use client";

import * as React from "react";
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
    const year = Number(local[1]);
    const month = Number(local[2]) - 1;
    const day = Number(local[3]);
    const hours = Number(local[4]);
    const minutes = Number(local[5]);
    const seconds = Number(local[6] ?? 0);
    if (hours > 23 || minutes > 59 || seconds > 59) return undefined;
    const date = new Date(year, month, day, hours, minutes, seconds);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day ||
      date.getHours() !== hours ||
      date.getMinutes() !== minutes ||
      date.getSeconds() !== seconds
    ) {
      return undefined;
    }
    return date;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/.exec(trimmed);
  if (!iso) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const year = Number(iso[1]);
  const month = Number(iso[2]) - 1;
  const day = Number(iso[3]);
  const hours = Number(iso[4]);
  const minutes = Number(iso[5]);
  const seconds = Number(iso[6] ?? 0);
  const milliseconds = iso[7] ? Number(iso[7].padEnd(3, "0").slice(0, 3)) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return undefined;
  const asWrittenUtc = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
  if (
    asWrittenUtc.getUTCFullYear() !== year ||
    asWrittenUtc.getUTCMonth() !== month ||
    asWrittenUtc.getUTCDate() !== day ||
    asWrittenUtc.getUTCHours() !== hours ||
    asWrittenUtc.getUTCMinutes() !== minutes ||
    asWrittenUtc.getUTCSeconds() !== seconds
  ) {
    return undefined;
  }
  if (iso[8] === "Z") return asWrittenUtc;
  const offsetHours = Number(iso[8].slice(1, 3));
  const offsetMins = Number(iso[8].slice(4, 6));
  if (offsetHours > 23 || offsetMins > 59) return undefined;
  const sign = iso[8].startsWith("-") ? -1 : 1;
  const offsetMinutes = sign * (offsetHours * 60 + offsetMins);
  return new Date(asWrittenUtc.getTime() - offsetMinutes * 60_000);
}

/** Format a date as a local `YYYY-MM-DDTHH:mm` string. */
export function formatDateTimeLocal(date: Date): string {
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${formatISODate(date)}T${time}`;
}

function atMinute(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes());
}

/** Clamp to min/max, then drop seconds without ending below min or above max. */
export function clampDateTime(date: Date, min?: Date, max?: Date): Date {
  let next = date;
  if (min && next < min) next = new Date(min.getTime());
  if (max && next > max) next = new Date(max.getTime());
  next = atMinute(next);
  if (min && next < min) next = atMinute(new Date(next.getTime() + 60_000));
  if (max && next > max) next = atMinute(max);
  return next;
}

function timeBoundOnDay(bound: Date | undefined, day: Date): string | undefined {
  if (!bound) return undefined;
  if (formatISODate(bound) !== formatISODate(day)) return undefined;
  return `${String(bound.getHours()).padStart(2, "0")}:${String(bound.getMinutes()).padStart(2, "0")}`;
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
  const dateValue = value ? parseISODate(formatISODate(value)) : undefined;
  const timeValue = value
    ? `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
    : "";
  const timeMin = dateValue ? timeBoundOnDay(min, dateValue) : undefined;
  const timeMax = dateValue ? timeBoundOnDay(max, dateValue) : undefined;
  const rootRef = React.useRef<HTMLDivElement>(null);

  function commit(date: Date) {
    onChange(clampDateTime(date, min, max));
  }

  function focusDateTrigger() {
    const trigger = rootRef.current?.querySelector("button");
    if (trigger instanceof HTMLButtonElement) trigger.focus();
  }

  return (
    <div ref={rootRef} className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <DatePicker
        value={dateValue}
        onChange={(date) => {
          if (!date) {
            onChange(undefined);
            return;
          }
          const time = parseTime(timeValue) || "00:00";
          const [hours, minutes] = time.split(":").map(Number);
          commit(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes));
        }}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        required={false}
        clearable={clearable ?? !required}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={required || undefined}
        className="min-w-0 flex-1"
      />
      <TimePicker
        value={timeValue}
        onChange={(time) => {
          if (!dateValue) return;
          const parsed = parseTime(time);
          if (!parsed) return;
          const [hours, minutes] = parsed.split(":").map(Number);
          commit(
            new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate(), hours, minutes),
          );
        }}
        disabled={disabled || !dateValue}
        min={timeMin}
        max={timeMax}
        required={false}
        className="sm:w-[11rem]"
        aria-label={ariaLabel ? `${ariaLabel}, waktu` : "Waktu"}
        aria-invalid={ariaInvalid}
      />
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value ? formatDateTimeLocal(value) : ""}
        required={required}
        disabled={disabled}
        className="sr-only"
        onChange={() => {}}
        onFocus={() => {
          focusDateTrigger();
        }}
        onInvalid={(event) => {
          event.preventDefault();
          focusDateTrigger();
        }}
      />
    </div>
  );
}
