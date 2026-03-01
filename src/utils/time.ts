const localeMap: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(locale: string): Intl.DateTimeFormat {
  if (!dateFormatters.has(locale)) {
    dateFormatters.set(
      locale,
      new Intl.DateTimeFormat(localeMap[locale] ?? "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    );
  }
  return dateFormatters.get(locale)!;
}

function getDateTimeFormatter(locale: string): Intl.DateTimeFormat {
  if (!dateTimeFormatters.has(locale)) {
    dateTimeFormatters.set(
      locale,
      new Intl.DateTimeFormat(localeMap[locale] ?? "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }
  return dateTimeFormatters.get(locale)!;
}

export function formatDate(date: Date, locale: string = "en"): string {
  return getDateFormatter(locale).format(date);
}

export function formatDateTime(date: Date, locale: string = "en"): string {
  return getDateTimeFormatter(locale).format(date);
}

export function getHourOfDay(date: Date): number {
  return date.getHours();
}

export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

export function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
