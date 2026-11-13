import { textEmptyState } from './empty-states';
import { registerTransform } from './registry';

registerTransform({
  id: 'base64-encode',
  emptyState: textEmptyState,
  name: 'Base64 Encode',
  description: 'Encode text to Base64',
  category: 'Encoding',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => btoa(unescape(encodeURIComponent(input))),
});

registerTransform({
  id: 'base64-decode',
  emptyState: { title: 'Ready for Base64', description: 'Paste Base64 on the left to decode it.', symbol: '64', trimWhitespace: true },
  name: 'Base64 Decode',
  description: 'Decode Base64 to text',
  category: 'Encoding',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => decodeURIComponent(escape(atob(input.trim()))),
});

registerTransform({
  id: 'url-encode',
  emptyState: textEmptyState,
  name: 'URL Encode',
  description: 'Percent-encode text for URLs',
  category: 'Encoding',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => encodeURIComponent(input),
});

registerTransform({
  id: 'url-decode',
  emptyState: { title: 'Ready for URL-encoded text', description: 'Paste URL-encoded text on the left to decode it.', symbol: '%' },
  name: 'URL Decode',
  description: 'Decode percent-encoded text',
  category: 'Encoding',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => decodeURIComponent(input),
});

registerTransform({
  id: 'html-encode',
  emptyState: textEmptyState,
  name: 'HTML Entity Encode',
  description: 'Encode special characters as HTML entities',
  category: 'Encoding',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
});

registerTransform({
  id: 'html-decode',
  emptyState: { title: 'Ready for HTML entities', description: 'Paste text containing HTML entities on the left to decode it.', symbol: '< >' },
  name: 'HTML Entity Decode',
  description: 'Decode HTML entities to characters',
  category: 'Encoding',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/'),
});

registerTransform({
  id: 'unicode-escape',
  emptyState: textEmptyState,
  name: 'Unicode Escape',
  description: 'Convert text to \\uXXXX escape sequences',
  category: 'Encoding',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    Array.from(input)
      .map((c) => {
        const code = c.codePointAt(0)!;
        return code > 127 ? `\\u${code.toString(16).padStart(4, '0')}` : c;
      })
      .join(''),
});

registerTransform({
  id: 'unicode-unescape',
  emptyState: { title: 'Ready for Unicode escapes', description: 'Paste text containing Unicode escapes on the left to decode it.', symbol: 'U+' },
  name: 'Unicode Unescape',
  description: 'Convert \\uXXXX sequences back to characters',
  category: 'Encoding',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    ),
});
