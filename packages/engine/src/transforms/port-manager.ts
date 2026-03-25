import { registerTransform } from './registry';

registerTransform({
  id: 'port-manager',
  name: 'Port Manager',
  description: 'Scan, inspect, and manage processes running on network ports',
  category: 'System',
  inputViews: [],
  outputViews: ['port-viewer', 'port-table'],
  fn: () => '', // viewer is self-contained, no transform needed
});
