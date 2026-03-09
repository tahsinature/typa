import { createTwoFilesPatch } from 'diff';
import { registerTransform } from './registry';

registerTransform({
  id: 'text-diff',
  name: 'Text Diff',
  description: 'Compare two texts and show differences',
  category: 'Diff',
  inputs: 2,
  inputViews: ['raw-input'],
  outputViews: ['raw-output', 'diff', 'visual-diff'],
  fn: (a, b) => {
    const patch = createTwoFilesPatch('Input A', 'Input B', a ?? '', b ?? '');
    return patch;
  },
});
