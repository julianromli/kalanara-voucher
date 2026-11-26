"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

export type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/** Accepts `HH:mm` or `HH:mm:ss` and returns `HH:mm`. */
export function parseTime(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "";
  return `${match[1]}:${match[2]}`;
}

export function TimePicker({
  value,
  onChange,
  id,
  disabled = false,
  name,
  required = false,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: TimePickerProps) {
  const parsed = parseTime(value);
  const hour = parsed ? parsed.slice(0, 2) : "";
  const minute = parsed ? parsed.slice(3, 5) : "";

  function commit(nextHour: string, nextMinute: string) {
    if (!nextHour && !nextMinute) {
      onChange("");
      return;
    }
    onChange(`${nextHour || "00"}:${nextMinute || "00"}`);
  }

  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      <Select
        value={hour || undefined}
        onValueChange={(next) => commit(next, minute)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-label="Jam"
          aria-invalid={ariaInvalid}
          className="h-11 min-h-11 min-w-0 flex-1 rounded-md text-base"
        >
          <SelectValue placeholder="Jam" />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[60] max-h-72">
          {HOURS.map((option) => (
            <SelectItem key={option} value={option} className="min-h-11 text-base">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-base text-muted-foreground" aria-hidden="true">
        :
      </span>
      <Select
        value={minute || undefined}
        onValueChange={(next) => commit(hour, next)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label="Menit"
          className="h-11 min-h-11 min-w-0 flex-1 rounded-md text-base"
        >
          <SelectValue placeholder="Menit" />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[60] max-h-72">
          {MINUTES.map((option) => (
            <SelectItem key={option} value={option} className="min-h-11 text-base">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={parsed}
        required={required}
        disabled={disabled}
        readOnly
        className="sr-only"
      />
    </div>
  );
}
