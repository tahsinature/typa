import { registerTransform } from './registry';

// Pass-through transform: the text flows straight to the viewer, where all the
// find / highlight / replace interaction lives (the search box is live state,
// not a fixed preset, so it can't be an input to `fn`).
registerTransform({
  id: 'text-finder',
  name: 'Find & Highlight',
  description:
    'Search text with literal or regex, highlight every match, filter to matching lines, and find & replace',
  category: 'Text',
  inputViews: ['raw-input'],
  outputViews: ['text-finder'],
  tips: [
    'Paste any text or code, then type in the search box to highlight every match.',
    'Toggle `.*` for regex, `Aa` for case-sensitive, and `\\b` for whole-word matching.',
    'Press `Enter` / `Shift+Enter` to jump to the next / previous match.',
    'Turn on the filter to show only the lines that contain a match (grep mode).',
    'In regex mode, `Replace all` supports group references like `$1`.',
  ],
  fn: (input) => input,
});
