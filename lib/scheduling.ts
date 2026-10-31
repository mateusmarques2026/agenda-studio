export const TIME_ZONE = "America/Fortaleza";
export const STEP = 15;
export const BUSINESS = { open: 540, lunchStart: 720, lunchEnd: 780, close: 1080 };
export type Service = { id: string; name: string; duration: number; price: number; active: number };
export type Booking = {
  id: string;
  date: string;
  start: number;
  duration: number;
  service_id: string;
  service_name: string;
  price: number;
  customer: string;
  phone: string;
  notes: string;
  status: "confirmed" | "completed" | "cancelled";
  created_at: string;
  client_user_id?: string | null;
  source?: "admin" | "customer";
};
export type Block = { id: string; date: string; start: number; duration: number; reason: string };
export type DayData = {
  services: Service[];
  bookings: Booking[];
  blocks: Block[];
  occupied: number[];
};
export const DEFAULT_SERVICES = [
  { id: "corte", name: "Corte de cabelo", duration: 30, price: 4000 },
  { id: "barba", name: "Barba e acabamento", duration: 30, price: 3000 },
  { id: "combo", name: "Corte + barba", duration: 60, price: 6500 },
];
export function zonedNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return {
    date: get("year") + "-" + get("month") + "-" + get("day"),
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function isDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
export function isOpenDay(date: string) {
  return new Date(date + "T12:00:00Z").getUTCDay() !== 0;
}
export function slotMinutes(start: number, duration: number) {
  return Array.from({ length: duration / STEP }, (_, i) => start + i * STEP);
}
export function fitsHours(start: number, duration: number) {
  const end = start + duration;
  return (
    Number.isInteger(start) &&
    Number.isInteger(duration) &&
    start % STEP === 0 &&
    duration > 0 &&
    duration % STEP === 0 &&
    start >= BUSINESS.open &&
    end <= BUSINESS.close &&
    !(start < BUSINESS.lunchEnd && end > BUSINESS.lunchStart)
  );
}
export function availableTimes(
  date: string,
  duration: number,
  occupied: number[],
  now = new Date(),
) {
  const current = zonedNow(now);
  if (!isDate(date) || !isOpenDay(date) || date < current.date || date > addDays(current.date, 90))
    return [];
  const taken = new Set(occupied);
  return Array.from(
    { length: (BUSINESS.close - BUSINESS.open) / STEP },
    (_, i) => BUSINESS.open + i * STEP,
  ).filter(
    (start) =>
      fitsHours(start, duration) &&
      (date > current.date || start > current.minute) &&
      slotMinutes(start, duration).every((m) => !taken.has(m)),
  );
}
export function formatTime(minute: number) {
  return (
    String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0")
  );
}
export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
) {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(
    new Date(date + "T12:00:00Z"),
  );
}
