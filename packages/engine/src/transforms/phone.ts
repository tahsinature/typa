import { parsePhoneNumberFromString, type NumberType } from 'libphonenumber-js/min';
import { registerTransform } from './registry';

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function invalid(line: string): string {
  return `Invalid phone: ${line}`;
}

function nationalDigits(
  line: string,
): { digits: string; ext?: string } | null {
  const trimmed = line.trim();
  const num = parsePhoneNumberFromString(trimmed);
  if (num && num.isPossible()) {
    return { digits: num.nationalNumber, ext: num.ext };
  }
  const d = digitsOnly(trimmed);
  if (!d) return null;
  return { digits: d };
}

function groupParens(d: string): string | null {
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return null;
}

function groupDashed(d: string): string | null {
  if (d.length === 10)
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return null;
}

function appendExt(formatted: string, ext?: string): string {
  return ext ? `${formatted} ext. ${ext}` : formatted;
}

function prettyType(t: NumberType | undefined): string {
  switch (t) {
    case 'MOBILE': return 'Mobile';
    case 'FIXED_LINE': return 'Landline';
    case 'FIXED_LINE_OR_MOBILE': return 'Mobile/Landline';
    case 'TOLL_FREE': return 'Toll-free';
    case 'PREMIUM_RATE': return 'Premium';
    case 'SHARED_COST': return 'Shared cost';
    case 'VOIP': return 'VoIP';
    case 'PERSONAL_NUMBER': return 'Personal';
    case 'PAGER': return 'Pager';
    case 'UAN': return 'UAN';
    case 'VOICEMAIL': return 'Voicemail';
    default: return '';
  }
}

interface PhoneFormats {
  e164: string;
  international: string;
  'national-parens': string;
  'national-dashed': string;
  'digits-only': string;
}

type PhoneRow = Record<string, string>;

function buildFormats(line: string): PhoneFormats {
  const trimmed = line.trim();
  const num = parsePhoneNumberFromString(trimmed);
  const possibleParse = num && num.isPossible();

  const e164 = possibleParse ? num.format('E.164') : invalid(trimmed);
  const international = possibleParse ? num.formatInternational() : invalid(trimmed);

  const got = nationalDigits(line);
  const grouped = got ? groupParens(got.digits) : null;
  const groupedDashed = got ? groupDashed(got.digits) : null;

  const nationalParens = grouped ? appendExt(grouped, got!.ext) : invalid(trimmed);
  const nationalDashed = groupedDashed ? appendExt(groupedDashed, got!.ext) : invalid(trimmed);

  const digitsResult = possibleParse
    ? num.countryCallingCode + num.nationalNumber
    : (digitsOnly(trimmed) || invalid(trimmed));

  return {
    e164,
    international,
    'national-parens': nationalParens,
    'national-dashed': nationalDashed,
    'digits-only': digitsResult,
  };
}

const PRESET_LABELS: Record<keyof PhoneFormats, string> = {
  'e164': 'E.164',
  'international': 'International',
  'national-parens': 'National (parens)',
  'national-dashed': 'National (dashed)',
  'digits-only': 'Digits only',
};

const DEFAULT_PRESET: keyof PhoneFormats = 'e164';

function buildRow(line: string, formats: PhoneFormats): PhoneRow {
  const trimmed = line.trim();
  const num = parsePhoneNumberFromString(trimmed);
  const parsed = num && num.isPossible() ? num : null;

  const row: PhoneRow = {
    Original: trimmed,
    Country: parsed?.country ?? '',
    Type: prettyType(parsed?.getType()),
    Extension: parsed?.ext ?? '',
  };
  for (const key of Object.keys(PRESET_LABELS) as (keyof PhoneFormats)[]) {
    row[PRESET_LABELS[key]] = formats[key];
  }
  return row;
}

function isPresetKey(s: string | undefined): s is keyof PhoneFormats {
  return !!s && s in PRESET_LABELS;
}

registerTransform({
  id: 'phone-format',
  name: 'Phone Format',
  description:
    'Format phone numbers — pick a preset (E.164, International, National, Digits only).',
  category: 'Formatting',
  presets: [
    { id: 'e164', label: 'E.164' },
    { id: 'international', label: 'International' },
    { id: 'national-parens', label: 'National (parens)' },
    { id: 'national-dashed', label: 'National (dashed)' },
    { id: 'digits-only', label: 'Digits only' },
  ],
  inputViews: ['raw-input'],
  outputViews: ['raw-output', 'table'],
  fn: (input, preset) => {
    const presetKey = isPresetKey(preset) ? preset : DEFAULT_PRESET;
    const lines = input.split('\n');

    const textLines: string[] = [];
    const rows: PhoneRow[] = [];

    for (const line of lines) {
      if (line.trim() === '') {
        textLines.push(line);
        continue;
      }
      const formats = buildFormats(line);
      textLines.push(formats[presetKey]);
      rows.push(buildRow(line, formats));
    }

    return {
      text: textLines.join('\n'),
      data: rows,
    };
  },
});
