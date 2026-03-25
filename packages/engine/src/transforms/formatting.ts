import { registerTransform } from './registry';

function splitWords(input: string): string[] {
  return input
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Line operations

registerTransform({
  id: 'sort-lines-asc',
  name: 'Sort Lines (A-Z)',
  description: 'Sort lines alphabetically ascending',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .split('\n')
      .sort((a, b) => a.localeCompare(b))
      .join('\n'),
});

registerTransform({
  id: 'sort-lines-desc',
  name: 'Sort Lines (Z-A)',
  description: 'Sort lines alphabetically descending',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .split('\n')
      .sort((a, b) => b.localeCompare(a))
      .join('\n'),
});

registerTransform({
  id: 'reverse-lines',
  name: 'Reverse Lines',
  description: 'Reverse the order of lines',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => input.split('\n').reverse().join('\n'),
});

registerTransform({
  id: 'unique-lines',
  name: 'Unique Lines',
  description: 'Remove duplicate lines',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => [...new Set(input.split('\n'))].join('\n'),
});

registerTransform({
  id: 'trim-lines',
  name: 'Trim Lines',
  description: 'Trim whitespace from each line',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .split('\n')
      .map((l) => l.trim())
      .join('\n'),
});

registerTransform({
  id: 'remove-empty-lines',
  name: 'Remove Empty Lines',
  description: 'Remove all blank lines',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .split('\n')
      .filter((l) => l.trim() !== '')
      .join('\n'),
});

registerTransform({
  id: 'find-duplicates',
  name: 'Find Duplicates',
  description: 'Find duplicate lines with counts and line numbers',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['duplicate-viewer'],
  fn: (input) => input,
});

// Case conversions

registerTransform({
  id: 'uppercase',
  name: 'UPPERCASE',
  description: 'Convert all text to uppercase',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => input.toUpperCase(),
});

registerTransform({
  id: 'lowercase',
  name: 'lowercase',
  description: 'Convert all text to lowercase',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => input.toLowerCase(),
});

registerTransform({
  id: 'title-case',
  name: 'Title Case',
  description: 'Capitalize the first letter of each word',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input.replace(
      /\b\w/g,
      (c) => c.toUpperCase(),
    ),
});

registerTransform({
  id: 'camel-case',
  name: 'camelCase',
  description: 'Convert to camelCase',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .split('\n')
      .map((line) => {
        const words = splitWords(line);
        return words
          .map((w, i) =>
            i === 0
              ? w.toLowerCase()
              : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
          )
          .join('');
      })
      .join('\n'),
});

registerTransform({
  id: 'pascal-case',
  name: 'PascalCase',
  description: 'Convert to PascalCase',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .split('\n')
      .map((line) =>
        splitWords(line)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(''),
      )
      .join('\n'),
});

registerTransform({
  id: 'snake-case',
  name: 'snake_case',
  description: 'Convert to snake_case',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .split('\n')
      .map((line) =>
        splitWords(line)
          .map((w) => w.toLowerCase())
          .join('_'),
      )
      .join('\n'),
});

registerTransform({
  id: 'kebab-case',
  name: 'kebab-case',
  description: 'Convert to kebab-case',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) =>
    input
      .split('\n')
      .map((line) =>
        splitWords(line)
          .map((w) => w.toLowerCase())
          .join('-'),
      )
      .join('\n'),
});
