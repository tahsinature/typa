import { registerTransform } from './registry';

registerTransform({
  id: 'mermaid-preview',
  name: 'Mermaid Diagram',
  description: 'Render Mermaid diagram syntax (flowchart, sequence, class, etc.)',
  category: 'Diagram',
  inputViews: ['raw-input'],
  outputViews: ['mermaid'],
  fn: (input) => input,
});
