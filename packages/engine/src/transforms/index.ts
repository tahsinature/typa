// Import all transform modules to trigger registration
import './json';
import './encoding';
import './hashing';
import './formatting';
import './web';
import './numbers';
import './ratio';
import './diff';
import './image-diff';
import './mermaid';
import './hierarchy';
import './code-image';
import './text-stats';
import './text-finder';
import './image-canvas';
import './image-inspector';
import './port-manager';
import './process-manager';
import './markdown-table';
import './phone';
import './present';

// Re-export registry
export {
  registerTransform,
  getTransform,
  getAllTransforms,
  getTransformEmptyState,
  searchTransforms,
  getCategories,
} from './registry';
