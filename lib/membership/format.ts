import { parseISODate } from "@/lib/membership/rules";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

const WEEKDAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

export function jakartaDateISO(value: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function formatMemberDate(value: string): string {
  const calendar = value.includes("T")
    ? jakartaDateISO(new Date(value))
    : value.slice(0, 10);
  const date = parseISODate(calendar);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatMemberWeekday(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  const date = parseISODate(parts);
  return `${WEEKDAYS[date.getUTCDay()]}, ${formatMemberDate(parts)}`;
}

export function formatMemberTime(value: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
  return parts.replace(":", ".");
}

export function maskMemberPhone(phone: string): string {
  const local = phone.startsWith("62") ? `0${phone.slice(2)}` : phone;
  if (local.length < 8) return local;
  return `${local.slice(0, 4)}-····-${local.slice(-4)}`;
}

export function memberInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
