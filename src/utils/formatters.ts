// Bengali numeral mapping
const BENGALI_DIGITS: { [key: string]: string } = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

export function toBengaliDigits(val: number | string | undefined | null): string {
  if (val === undefined || val === null) return '';
  return val.toString().replace(/[0-9]/g, (match) => BENGALI_DIGITS[match] || match);
}

export function formatTaka(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '৳০';
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  return `৳${toBengaliDigits(num.toLocaleString('en-US'))}`;
}

export function getTodayDhakaDate(): string {
  const now = new Date();
  // Dhaka is UTC+6
  const dhakaTime = new Date(now.getTime() + 6 * 3600 * 1000);
  return dhakaTime.toISOString().split('T')[0];
}

/**
 * Formats any YYYY-MM-DD, DD-MM-YYYY, or ISO string as dd-mm-yyyy (Asia/Dhaka for ISO timestamps)
 */
export function formatDateDMY(dateStr?: string, bengaliDigits: boolean = true): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  const fmt = (val: string) => (bengaliDigits ? toBengaliDigits(val) : val);

  try {
    // Match YYYY-MM-DD (standalone or date prefix before T)
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return fmt(`${day}-${month}-${year}`);
    }

    // Already DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return fmt(`${day}-${month}-${year}`);
    }

    // ISO timestamp or Date-parseable string -> format in Asia/Dhaka (UTC+6)
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const dhaka = new Date(d.getTime() + 6 * 3600 * 1000);
      const day = String(dhaka.getUTCDate()).padStart(2, '0');
      const month = String(dhaka.getUTCMonth() + 1).padStart(2, '0');
      const year = String(dhaka.getUTCFullYear());
      return fmt(`${day}-${month}-${year}`);
    }
  } catch {
    // fall through
  }

  return fmt(trimmed);
}

export function formatBengaliDate(dateStr?: string): string {
  return formatDateDMY(dateStr, true);
}

/**
 * Formats any time string ("19:14", "07:14 PM", "7:14 AM") or ISO timestamp into 12-hour format (hh:mm AM/PM)
 */
export function formatTime12Hour(timeOrIso?: string, bengaliDigits: boolean = true): string {
  if (!timeOrIso) return '';
  const trimmed = timeOrIso.trim();
  const fmt = (val: string) => (bengaliDigits ? toBengaliDigits(val) : val);

  try {
    // 1. Explicit 12h string (e.g. "7:14 PM" or "07:14:30 AM")
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      if (h < 1 || h > 12) h = ((h % 12) || 12);
      const m = match12[2].padStart(2, '0');
      const s = match12[3] ? `:${match12[3].padStart(2, '0')}` : '';
      const period = match12[4].toUpperCase();
      return fmt(`${String(h).padStart(2, '0')}:${m}${s} ${period}`);
    }

    // 2. 24h time string (e.g. "19:14" or "19:14:15" or "00:30")
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*BST)?$/i);
    if (match24) {
      let h24 = parseInt(match24[1], 10);
      const m = match24[2].padStart(2, '0');
      const s = match24[3] ? `:${match24[3].padStart(2, '0')}` : '';
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 || 12;
      return fmt(`${String(h12).padStart(2, '0')}:${m}${s} ${period}`);
    }

    // 3. Full ISO timestamp -> Asia/Dhaka (UTC+6)
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const dhaka = new Date(d.getTime() + 6 * 3600 * 1000);
      const h24 = dhaka.getUTCHours();
      const m = String(dhaka.getUTCMinutes()).padStart(2, '0');
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 || 12;
      return fmt(`${String(h12).padStart(2, '0')}:${m} ${period}`);
    }
  } catch {
    // fall through
  }

  return fmt(trimmed);
}

/**
 * Current Asia/Dhaka live clock in 12-hour format
 */
export function getNowDhakaTime12h(includeSeconds: boolean = true, bengaliDigits: boolean = true): string {
  const now = new Date();
  const dhaka = new Date(now.getTime() + 6 * 3600 * 1000);
  const h24 = dhaka.getUTCHours();
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = String(h24 % 12 || 12).padStart(2, '0');
  const m = String(dhaka.getUTCMinutes()).padStart(2, '0');
  const s = includeSeconds ? `:${String(dhaka.getUTCSeconds()).padStart(2, '0')}` : '';
  const out = `${h12}:${m}${s} ${period}`;
  return bengaliDigits ? toBengaliDigits(out) : out;
}

export function formatBengaliDateTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const dateFormatted = formatDateDMY(isoString, true);
    const timeFormatted = formatTime12Hour(isoString, true);
    if (dateFormatted && timeFormatted) {
      return `${dateFormatted}, ${timeFormatted}`;
    }
    return dateFormatted || timeFormatted || isoString;
  } catch {
    return isoString;
  }
}
