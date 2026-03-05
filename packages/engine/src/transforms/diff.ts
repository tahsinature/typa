import { createTwoFilesPatch } from 'diff';
import { registerTransform } from './registry';

registerTransform({
  id: 'text-diff',
  name: 'Text Diff',
  description: 'Compare two texts and show differences',
  category: 'Diff',
  inputs: 2,
  viewers: [
    { id: 'diff', parse: (output) => output },
    { id: 'visual-diff', parse: (output) => output },
  ],
  fn: (a, b) => {
    const patch = createTwoFilesPatch('Input A', 'Input B', a ?? '', b ?? '');
    return patch;
  },
});
