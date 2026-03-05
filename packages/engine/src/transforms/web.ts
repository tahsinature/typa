import { registerTransform } from './registry';

registerTransform({
  id: 'jwt-decode',
  name: 'JWT Decode',
  description: 'Decode a JWT token (header + payload)',
  category: 'Web',
  fn: (input) => {
    const parts = input.trim().split('.');
    if (parts.length !== 3) return 'Invalid JWT: expected 3 parts';

    const decode = (s: string) => {
      const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b64));
    };

    const header = decode(parts[0]);
    const payload = decode(parts[1]);
    return JSON.stringify({ header, payload }, null, 2);
  },
});

registerTransform({
  id: 'querystring-to-json',
  name: 'Query String to JSON',
  description: 'Parse URL query string into JSON',
  category: 'Web',
  fn: (input) => {
    const cleaned = input.trim().replace(/^\?/, '');
    const params = new URLSearchParams(cleaned);
    const obj: Record<string, string> = {};
    params.forEach((value, key) => {
      obj[key] = value;
    });
    return JSON.stringify(obj, null, 2);
  },
});

registerTransform({
  id: 'json-to-querystring',
  name: 'JSON to Query String',
  description: 'Convert JSON object to URL query string',
  category: 'Web',
  fn: (input) => {
    const obj = JSON.parse(input);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(obj)) {
      params.set(key, String(value));
    }
    return params.toString();
  },
});

registerTransform({
  id: 'generate-uuid',
  name: 'Generate UUID',
  description: 'Generate a random UUID v4 (ignores input)',
  category: 'Web',
  fn: () => crypto.randomUUID(),
});

registerTransform({
  id: 'timestamp-to-date',
  name: 'Unix Timestamp to Date',
  description: 'Convert Unix timestamp to ISO date string',
  category: 'Web',
  fn: (input) => {
    const ts = parseInt(input.trim());
    if (isNaN(ts)) return 'Invalid timestamp';
    const ms = ts < 1e12 ? ts * 1000 : ts;
    return new Date(ms).toISOString();
  },
});

registerTransform({
  id: 'date-to-timestamp',
  name: 'Date to Unix Timestamp',
  description: 'Convert date string to Unix timestamp (seconds)',
  category: 'Web',
  fn: (input) => {
    const date = new Date(input.trim());
    if (isNaN(date.getTime())) return 'Invalid date';
    return String(Math.floor(date.getTime() / 1000));
  },
});
