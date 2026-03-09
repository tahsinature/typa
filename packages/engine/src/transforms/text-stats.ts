import { registerTransform } from './registry';

registerTransform({
  id: 'text-stats',
  name: 'Character Counter',
  description: 'Count characters, words, lines, sentences, and paragraphs',
  category: 'Text',
  inputViews: ['raw-input'],
  outputViews: ['counter'],
  fn: (input) => {
    const characters = input.length;
    const charactersNoSpaces = input.replace(/\s/g, '').length;
    const words = input.trim() ? input.trim().split(/\s+/).length : 0;
    const lines = input ? input.split('\n').length : 0;
    const sentences = input.trim()
      ? (input.match(/[.!?]+(?:\s|$)/g) || []).length
      : 0;
    const paragraphs = input.trim()
      ? input.split(/\n\s*\n/).filter((p) => p.trim()).length
      : 0;

    return JSON.stringify({
      characters,
      charactersNoSpaces,
      words,
      lines,
      sentences,
      paragraphs,
    });
  },
});
