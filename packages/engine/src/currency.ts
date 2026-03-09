export const CURRENCY_CODES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN',
  'BRL', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'NZD', 'ZAR', 'THB',
  'TWD', 'SAR', 'AED', 'PLN', 'CZK', 'ILS', 'PHP', 'MYR', 'IDR', 'RUB',
  'TRY', 'BDT', 'PKR', 'VND', 'NGN', 'EGP', 'ARS', 'CLP', 'COP', 'PEN',
]);

export const CURRENCY_NAMES: Record<string, string> = {
  dollar: 'USD',
  dollars: 'USD',
  euro: 'EUR',
  euros: 'EUR',
  yen: 'JPY',
  rupee: 'INR',
  rupees: 'INR',
  won: 'KRW',
  franc: 'CHF',
  francs: 'CHF',
  yuan: 'CNY',
  peso: 'MXN',
  pesos: 'MXN',
  real: 'BRL',
  reais: 'BRL',
  baht: 'THB',
  ringgit: 'MYR',
  rand: 'ZAR',
  lira: 'TRY',
  krona: 'SEK',
  kronor: 'SEK',
  krone: 'NOK',
  kroner: 'NOK',
};

/**
 * Register currency units on a math.js instance.
 * @param rates — { EUR: 0.92, GBP: 0.79, … } where 1 USD = rates[X] of that currency
 */
export function registerCurrencies(
  math: { createUnit: (name: string, definition?: string, options?: { override?: boolean }) => void },
  rates: Record<string, number>,
): void {
  math.createUnit('USD');

  for (const [code, rate] of Object.entries(rates)) {
    if (code === 'USD' || rate <= 0) continue;
    if (!CURRENCY_CODES.has(code)) continue;
    try {
      // 1 USD = rate units of CODE  →  1 CODE = (1/rate) USD
      math.createUnit(code, `${1 / rate} USD`);
    } catch {
      // skip if unit already exists or creation fails
    }
  }
}
