import { jsonEmptyState } from './empty-states';
import { registerTransform } from './registry';

registerTransform({
  id: 'jwt-decode',
  emptyState: { title: 'Ready for a token', description: 'Paste a JWT on the left to inspect its header and payload.', symbol: '{ }', trimWhitespace: true },
  name: 'JWT Decode',
  description: 'Decode a JWT token (header + payload)',
  category: 'Web',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
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
  emptyState: { title: 'Ready for a query string', description: 'Paste URL parameters such as name=Alex&count=2 to see them as JSON.', symbol: '?', trimWhitespace: true },
  name: 'Query String to JSON',
  description: 'Parse URL query string into JSON',
  category: 'Web',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
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
  emptyState: jsonEmptyState,
  name: 'JSON to Query String',
  description: 'Convert JSON object to URL query string',
  category: 'Web',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
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
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: () => crypto.randomUUID(),
});

registerTransform({
  id: 'timestamp-to-date',
  emptyState: { title: 'Ready for a timestamp', description: 'Enter a Unix timestamp on the left to convert it to a date.', symbol: '01', trimWhitespace: true },
  name: 'Unix Timestamp to Date',
  description: 'Convert Unix timestamp to ISO date string',
  category: 'Web',
  inputViews: ['raw-input', 'date-picker'],
  outputViews: ['raw-output'],
  fn: (input) => {
    const ts = parseInt(input.trim());
    if (isNaN(ts)) return 'Invalid timestamp';
    const ms = ts < 1e12 ? ts * 1000 : ts;
    return new Date(ms).toISOString();
  },
});

registerTransform({
  id: 'date-to-timestamp',
  emptyState: { title: 'Ready for a date', description: 'Enter a date on the left or choose one with the date picker.', symbol: '01', trimWhitespace: true },
  name: 'Date to Unix Timestamp',
  description: 'Convert date string to Unix timestamp (seconds)',
  category: 'Web',
  inputViews: ['raw-input', 'date-picker'],
  outputViews: ['raw-output'],
  fn: (input) => {
    const date = new Date(input.trim());
    if (isNaN(date.getTime())) return 'Invalid date';
    return String(Math.floor(date.getTime() / 1000));
  },
});
