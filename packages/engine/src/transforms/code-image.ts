import { registerTransform } from './registry';

registerTransform({
  id: 'code-to-image',
  name: 'Code to Image',
  description: 'Generate beautiful code screenshots (like ray.so)',
  category: 'Image',
  inputViews: ['raw-input'],
  outputViews: ['code-image'],
  fn: (input) => input,
});
