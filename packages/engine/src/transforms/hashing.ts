import { registerTransform } from './registry';

async function hash(algorithm: string, input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest(algorithm, data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

registerTransform({
  id: 'sha1',
  name: 'SHA-1',
  description: 'Compute SHA-1 hash',
  category: 'Hashing',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => hash('SHA-1', input),
});

registerTransform({
  id: 'sha256',
  name: 'SHA-256',
  description: 'Compute SHA-256 hash',
  category: 'Hashing',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => hash('SHA-256', input),
});

registerTransform({
  id: 'sha384',
  name: 'SHA-384',
  description: 'Compute SHA-384 hash',
  category: 'Hashing',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => hash('SHA-384', input),
});

registerTransform({
  id: 'sha512',
  name: 'SHA-512',
  description: 'Compute SHA-512 hash',
  category: 'Hashing',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => hash('SHA-512', input),
});
