"use client";

import * as React from "react";
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
  min?: string;
  max?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/** Accepts `HH:mm` or `HH:mm:ss` and returns `HH:mm`. */
export function parseTime(value: string): string {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return "";
  return `${match[1]}:${match[2]}`;
}

function timeToMinutes(value: string): number | undefined {
  const parsed = parseTime(value);
  if (!parsed) return undefined;
  return Number(parsed.slice(0, 2)) * 60 + Number(parsed.slice(3, 5));
}

function isHourDisabled(hour: string, min?: string, max?: string): boolean {
  const hourMinutes = Number(hour) * 60;
  const minMinutes = min ? timeToMinutes(min) : undefined;
  const maxMinutes = max ? timeToMinutes(max) : undefined;
  if (minMinutes !== undefined && hourMinutes + 59 < minMinutes) return true;
  if (maxMinutes !== undefined && hourMinutes > maxMinutes) return true;
  return false;
}

function isMinuteDisabled(hour: string, minute: string, min?: string, max?: string): boolean {
  if (!hour) return false;
  const value = Number(hour) * 60 + Number(minute);
  const minMinutes = min ? timeToMinutes(min) : undefined;
  const maxMinutes = max ? timeToMinutes(max) : undefined;
  if (minMinutes !== undefined && value < minMinutes) return true;
  if (maxMinutes !== undefined && value > maxMinutes) return true;
  return false;
}

function clampTime(hour: string, minute: string, min?: string, max?: string): string {
  const next = `${hour || "00"}:${minute || "00"}`;
  const minutes = timeToMinutes(next);
  if (minutes === undefined) return next;
  const minMinutes = min ? timeToMinutes(min) : undefined;
  const maxMinutes = max ? timeToMinutes(max) : undefined;
  let clamped = minutes;
  if (minMinutes !== undefined && clamped < minMinutes) clamped = minMinutes;
  if (maxMinutes !== undefined && clamped > maxMinutes) clamped = maxMinutes;
  const nextHour = String(Math.floor(clamped / 60)).padStart(2, "0");
  const nextMinute = String(clamped % 60).padStart(2, "0");
  return `${nextHour}:${nextMinute}`;
}

function partLabel(field: string | undefined, part: "jam" | "menit"): string {
  return field ? `${field} ${part}` : part === "jam" ? "Jam" : "Menit";
}

export function TimePicker({
  value,
  onChange,
  id,
  disabled = false,
  name,
  required = false,
  min,
  max,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: TimePickerProps) {
  const parsed = parseTime(value);
  const hour = parsed ? parsed.slice(0, 2) : "";
  const minute = parsed ? parsed.slice(3, 5) : "";
  const hourTriggerRef = React.useRef<HTMLButtonElement>(null);
  const hourLabel = partLabel(ariaLabel, "jam");
  const minuteLabel = partLabel(ariaLabel, "menit");

  function commit(nextHour: string, nextMinute: string) {
    if (!nextHour && !nextMinute) {
      onChange("");
      return;
    }
    onChange(clampTime(nextHour, nextMinute, min, max));
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
        value={hour}
        onValueChange={(next) => commit(next, minute)}
        disabled={disabled}
      >
        <SelectTrigger
          ref={hourTriggerRef}
          id={id}
          aria-label={hourLabel}
          aria-labelledby={ariaLabel ? undefined : ariaLabelledBy}
          aria-invalid={ariaInvalid}
          aria-required={required || undefined}
          className="h-11 min-h-11 min-w-0 flex-1 rounded-md text-base"
        >
          <SelectValue placeholder="Jam" />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[60] max-h-72">
          {HOURS.map((option) => (
            <SelectItem
              key={option}
              value={option}
              disabled={isHourDisabled(option, min, max)}
              className="min-h-11 text-base"
            >
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-base text-muted-foreground" aria-hidden="true">
        :
      </span>
      <Select
        value={minute}
        onValueChange={(next) => commit(hour, next)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={minuteLabel}
          aria-invalid={ariaInvalid}
          aria-required={required || undefined}
          className="h-11 min-h-11 min-w-0 flex-1 rounded-md text-base"
        >
          <SelectValue placeholder="Menit" />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[60] max-h-72">
          {MINUTES.map((option) => (
            <SelectItem
              key={option}
              value={option}
              disabled={isMinuteDisabled(hour, option, min, max)}
              className="min-h-11 text-base"
            >
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
        className="sr-only"
        onChange={() => {}}
        onFocus={() => hourTriggerRef.current?.focus()}
        onInvalid={(event) => {
          event.preventDefault();
          hourTriggerRef.current?.focus();
        }}
      />
    </div>
  );
}
