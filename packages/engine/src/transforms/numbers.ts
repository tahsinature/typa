import { registerTransform } from './registry';

function mapLines(
  input: string,
  fn: (line: string) => string,
): string {
  return input
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      return fn(trimmed);
    })
    .join('\n');
}

registerTransform({
  id: 'hex-to-decimal',
  name: 'Hex to Decimal',
  description: 'Convert hexadecimal numbers to decimal',
  category: 'Numbers',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    mapLines(input, (line) => {
      const n = parseInt(line.replace(/^0x/i, ''), 16);
      return isNaN(n) ? line : String(n);
    }),
});

registerTransform({
  id: 'decimal-to-hex',
  name: 'Decimal to Hex',
  description: 'Convert decimal numbers to hexadecimal',
  category: 'Numbers',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    mapLines(input, (line) => {
      const n = parseInt(line, 10);
      return isNaN(n) ? line : '0x' + n.toString(16).toUpperCase();
    }),
});

registerTransform({
  id: 'decimal-to-binary',
  name: 'Decimal to Binary',
  description: 'Convert decimal numbers to binary',
  category: 'Numbers',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    mapLines(input, (line) => {
      const n = parseInt(line, 10);
      return isNaN(n) ? line : '0b' + n.toString(2);
    }),
});

registerTransform({
  id: 'binary-to-decimal',
  name: 'Binary to Decimal',
  description: 'Convert binary numbers to decimal',
  category: 'Numbers',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    mapLines(input, (line) => {
      const n = parseInt(line.replace(/^0b/i, ''), 2);
      return isNaN(n) ? line : String(n);
    }),
});

registerTransform({
  id: 'decimal-to-octal',
  name: 'Decimal to Octal',
  description: 'Convert decimal numbers to octal',
  category: 'Numbers',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    mapLines(input, (line) => {
      const n = parseInt(line, 10);
      return isNaN(n) ? line : '0o' + n.toString(8);
    }),
});

registerTransform({
  id: 'octal-to-decimal',
  name: 'Octal to Decimal',
  description: 'Convert octal numbers to decimal',
  category: 'Numbers',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    mapLines(input, (line) => {
      const n = parseInt(line.replace(/^0o/i, ''), 8);
      return isNaN(n) ? line : String(n);
    }),
});

registerTransform({
  id: 'hex-to-rgb',
  name: 'Hex Color to RGB',
  description: 'Convert hex color (#ff5733) to rgb()',
  category: 'Numbers',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    mapLines(input, (line) => {
      const match = line.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      if (!match) return line;
      const [, r, g, b] = match;
      return `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`;
    }),
});

registerTransform({
  id: 'rgb-to-hex',
  name: 'RGB to Hex Color',
  description: 'Convert rgb(r, g, b) to hex color',
  category: 'Numbers',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    mapLines(input, (line) => {
      const match = line.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (!match) return line;
      const hex = [match[1], match[2], match[3]]
        .map((n) => parseInt(n).toString(16).padStart(2, '0'))
        .join('');
      return '#' + hex;
    }),
});
