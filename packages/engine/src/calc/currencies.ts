import { CURRENCY } from './dimensions';
import type { UnitDef } from './units';

/** Approximate USD rates used until live rates load (1 USD = rate × code). */
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150, CAD: 1.37, AUD: 1.52, CHF: 0.88, CNY: 7.2,
  INR: 84, MXN: 18, BRL: 5.5, KRW: 1380, SGD: 1.34, HKD: 7.8, NOK: 10.8, SEK: 10.5,
  DKK: 6.9, NZD: 1.66, ZAR: 18, THB: 34, TWD: 32, SAR: 3.75, AED: 3.67, PLN: 3.95,
  CZK: 23, ILS: 3.7, PHP: 57, MYR: 4.5, IDR: 16000, RUB: 92, TRY: 34, BDT: 120,
  PKR: 280, VND: 25000, NGN: 1600, EGP: 49, ARS: 950, CLP: 930, COP: 4100, PEN: 3.75,
};

/** Currency names people type, mapped to ISO codes. */
const NAMES: Record<string, string> = {
  dollar: 'USD', dollars: 'USD', buck: 'USD', bucks: 'USD',
  euro: 'EUR', euros: 'EUR',
  'british pound': 'GBP', quid: 'GBP', sterling: 'GBP',
  yen: 'JPY', rupee: 'INR', rupees: 'INR', 'indian rupee': 'INR', 'indian rupees': 'INR',
  won: 'KRW', franc: 'CHF', francs: 'CHF', 'swiss franc': 'CHF', 'swiss francs': 'CHF',
  yuan: 'CNY', renminbi: 'CNY', rmb: 'CNY', peso: 'MXN', pesos: 'MXN', real: 'BRL', reais: 'BRL',
  baht: 'THB', ringgit: 'MYR', rand: 'ZAR', lira: 'TRY', taka: 'BDT',
  krona: 'SEK', kronor: 'SEK', krone: 'NOK', kroner: 'NOK', ruble: 'RUB', rubles: 'RUB',
};

/** Symbols written before or after an amount. */
export const SYMBOLS: Record<string, string> = {
  $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR', '₩': 'KRW', '₽': 'RUB',
  '₺': 'TRY', '₱': 'PHP', '฿': 'THB', '₫': 'VND', '₦': 'NGN', '₪': 'ILS', '৳': 'BDT',
};

/** Lowercase codes that are also ordinary words, so they only count in uppercase. */
const WORD_LIKE_CODES = new Set(['TRY', 'ALL', 'TOP', 'MOP', 'CUP', 'BOB', 'GEL', 'MAD']);

export function currencyNames(): string[] {
  return Object.keys(NAMES);
}

export class CurrencyTable {
  private rates: Record<string, number> = { ...FALLBACK_RATES };
  private units = new Map<string, UnitDef>();

  /** Merges live rates over the fallback table. */
  setRates(rates: Record<string, number>): void {
    this.rates = { ...FALLBACK_RATES };
    for (const [code, rate] of Object.entries(rates)) {
      if (/^[A-Z]{3}$/.test(code) && rate > 0) this.rates[code] = rate;
    }
    this.units.clear();
  }

  codes(): string[] {
    return Object.keys(this.rates);
  }

  /** Resolves a code ("eur"), a name ("euros") or a symbol ("€") to a currency unit. */
  find(token: string): UnitDef | undefined {
    const code = SYMBOLS[token] ?? NAMES[token.toLowerCase()] ?? this.codeFor(token);
    return code ? this.unit(code) : undefined;
  }

  private codeFor(token: string): string | undefined {
    if (token.length !== 3) return undefined;
    const upper = token.toUpperCase();
    if (!(upper in this.rates)) return undefined;
    if (token !== upper && WORD_LIKE_CODES.has(upper)) return undefined;
    return upper;
  }

  private unit(code: string): UnitDef {
    let unit = this.units.get(code);
    if (!unit) {
      unit = { symbol: code, dims: CURRENCY, factor: 1 / this.rates[code], label: code };
      this.units.set(code, unit);
    }
    return unit;
  }
}
