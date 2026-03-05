import { registerTransform } from './registry';

registerTransform({
  id: 'json-format',
  name: 'Format JSON',
  description: 'Pretty-print JSON with 2-space indentation',
  category: 'JSON',
  fn: (input) => JSON.stringify(JSON.parse(input), null, 2),
});

registerTransform({
  id: 'json-minify',
  name: 'Minify JSON',
  description: 'Remove all whitespace from JSON',
  category: 'JSON',
  fn: (input) => JSON.stringify(JSON.parse(input)),
});

registerTransform({
  id: 'json-validate',
  name: 'Validate JSON',
  description: 'Check if input is valid JSON',
  category: 'JSON',
  fn: (input) => {
    try {
      JSON.parse(input);
      return 'Valid JSON';
    } catch (e) {
      return `Invalid JSON: ${(e as Error).message}`;
    }
  },
});
