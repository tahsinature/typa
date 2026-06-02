import { registerTransform } from './registry';

registerTransform({
  id: 'image-inspector',
  name: 'Image Inspector',
  description: 'Paste and deep-zoom into images to inspect pixel-level detail',
  category: 'Image',
  inputs: 1,
  inputViews: [],
  outputViews: ['image-inspector'],
  fn: (input) => input || '',
});
