"use client";

import * as React from "react";
import { format } from "date-fns";
import { id as dateFnsId } from "date-fns/locale";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { id as dayPickerId } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_MIN_YEAR = 1900;
const MONTH_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export type DatePickerProps = {
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
  "aria-required"?: boolean | "true" | "false";
};

/** Parse a `YYYY-MM-DD` calendar date as local midnight, not UTC. */
export function parseISODate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

/** Format a date as a local `YYYY-MM-DD` calendar date. */
export function formatISODate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(date: Date): string {
  return format(date, "d MMMM yyyy", { locale: dateFnsId });
}

/** True when a pointer/focus event landed on the date picker popover or its Select menus. */
export function isDatePickerLayer(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("[data-slot=popover-content], [data-slot=select-content]"))
  );
}

/** Use on DialogContent so clicking the calendar or its menus does not close the dialog. */
export function preventCloseOnDatePickerLayer(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (isDatePickerLayer(event.target)) event.preventDefault();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function clampMonth(date: Date, min?: Date, max?: Date): Date {
  let next = startOfMonth(date);
  if (min && next < startOfMonth(min)) next = startOfMonth(min);
  if (max && next > startOfMonth(max)) next = startOfMonth(max);
  return next;
}

function yearRange(min?: Date, max?: Date): number[] {
  const start = min?.getFullYear() ?? DEFAULT_MIN_YEAR;
  const end = max?.getFullYear() ?? new Date().getFullYear();
  const years: number[] = [];
  for (let year = start; year <= end; year += 1) {
    years.push(year);
  }
  return years;
}

function isMonthDisabled(year: number, monthIndex: number, min?: Date, max?: Date): boolean {
  const month = new Date(year, monthIndex, 1);
  if (min && startOfMonth(month) < startOfMonth(min)) return true;
  if (max && startOfMonth(month) > startOfMonth(max)) return true;
  return false;
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pilih tanggal",
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
  "aria-required": ariaRequired,
}: DatePickerProps) {
  const canClear = clearable ?? !required;
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(() =>
    clampMonth(value ?? new Date(), min, max),
  );
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const years = React.useMemo(() => yearRange(min, max), [min, max]);

  React.useEffect(() => {
    if (value) setMonth(clampMonth(value, min, max));
  }, [value, min, max]);

  const disabledDays = React.useMemo(() => {
    const rules: Array<{ before: Date } | { after: Date }> = [];
    if (min) rules.push({ before: startOfDay(min) });
    if (max) rules.push({ after: startOfDay(max) });
    return rules;
  }, [min, max]);

  return (
    <div className={cn("relative", className)}>
      <CalendarIcon
        className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
        }}
        modal
      >
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            id={id}
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            aria-required={ariaRequired ?? required}
            aria-haspopup="dialog"
            className={cn(
              "relative h-11 min-h-11 w-full justify-start rounded-md px-3 text-left text-base font-normal",
              "border-input bg-background hover:bg-background dark:bg-input/30 dark:hover:bg-input/30",
              "focus-visible:border-ring focus-visible:ring-ring/50",
              !value && "text-muted-foreground",
              canClear && value ? "pr-20" : "pr-3",
              "pl-10",
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {value ? formatDateLabel(value) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="z-[60] w-auto p-0"
          onPointerDownOutside={(event) => {
            if (isDatePickerLayer(event.target)) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (isDatePickerLayer(event.target)) event.preventDefault();
          }}
        >
          <div className="flex items-center gap-1 p-3 pb-1">
            <Button
              type="button"
              variant="ghost"
              className="size-11 shrink-0"
              aria-label="Bulan sebelumnya"
              disabled={Boolean(min && startOfMonth(addMonths(month, -1)) < startOfMonth(min))}
              onClick={() => setMonth((current) => clampMonth(addMonths(current, -1), min, max))}
            >
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </Button>
            <Select
              value={String(month.getMonth())}
              onValueChange={(next) => {
                setMonth(clampMonth(new Date(month.getFullYear(), Number(next), 1), min, max));
              }}
            >
              <SelectTrigger
                aria-label="Bulan"
                className="h-11 min-h-11 min-w-0 flex-1 rounded-md text-base"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[60] max-h-72">
                {MONTH_INDEXES.map((index) => (
                  <SelectItem
                    key={index}
                    value={String(index)}
                    disabled={isMonthDisabled(month.getFullYear(), index, min, max)}
                    className="min-h-11 text-base"
                  >
                    {format(new Date(2020, index, 1), "MMMM", { locale: dateFnsId })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(month.getFullYear())}
              onValueChange={(next) => {
                setMonth(clampMonth(new Date(Number(next), month.getMonth(), 1), min, max));
              }}
            >
              <SelectTrigger
                aria-label="Tahun"
                className="h-11 min-h-11 min-w-0 flex-1 rounded-md text-base"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[60] max-h-72">
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)} className="min-h-11 text-base">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              className="size-11 shrink-0"
              aria-label="Bulan berikutnya"
              disabled={Boolean(max && startOfMonth(addMonths(month, 1)) > startOfMonth(max))}
              onClick={() => setMonth((current) => clampMonth(addMonths(current, 1), min, max))}
            >
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <Calendar
            mode="single"
            locale={dayPickerId}
            month={month}
            onMonthChange={(next) => setMonth(clampMonth(next, min, max))}
            selected={value}
            onSelect={(date) => {
              if (!date) {
                if (canClear) onChange(undefined);
                return;
              }
              onChange(startOfDay(date));
              setOpen(false);
            }}
            disabled={disabledDays}
            startMonth={min ? startOfMonth(min) : new Date(DEFAULT_MIN_YEAR, 0, 1)}
            endMonth={max ? startOfMonth(max) : undefined}
            hideNavigation
            classNames={{ month_caption: "hidden" }}
            className="[--cell-size:2.75rem] p-3 pt-1"
          />
        </PopoverContent>
      </Popover>
      {canClear && value && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          className="absolute top-0 right-0 h-11 w-11 text-muted-foreground hover:text-foreground"
          aria-label="Hapus tanggal"
          onClick={() => {
            onChange(undefined);
            triggerRef.current?.focus();
          }}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value ? formatISODate(value) : ""}
        required={required}
        disabled={disabled}
        readOnly
        className="sr-only"
        onFocus={() => triggerRef.current?.focus()}
        onInvalid={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      />
    </div>
  );
}
