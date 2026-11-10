import { registerTransform } from './registry';

registerTransform({
  id: 'process-manager',
  name: 'Process Manager',
  description: 'Find running processes, inspect memory usage, stop or force kill a process',
  category: 'System',
  inputViews: [],
  outputViews: ['process-manager'],
  fn: () => '',
});
