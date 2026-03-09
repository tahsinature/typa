const API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY = 'typa:currency-rates';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

interface CachedRates {
  rates: Record<string, number>;
  timestamp: number;
}

export async function fetchCurrencyRates(): Promise<Record<string, number>> {
  const cached = getCachedRates();
  if (cached) return cached;

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.rates && typeof data.rates === 'object') {
      const rates = data.rates as Record<string, number>;
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ rates, timestamp: Date.now() }),
      );
      return rates;
    }
    throw new Error('Invalid API response');
  } catch {
    // Fall back to expired cache if fetch fails
    const expired = getCachedRates(true);
    if (expired) return expired;
    return {};
  }
}

function getCachedRates(ignoreExpiry = false): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedRates = JSON.parse(raw);
    if (!ignoreExpiry && Date.now() - cached.timestamp > CACHE_TTL) return null;
    return cached.rates;
  } catch {
    return null;
  }
}
