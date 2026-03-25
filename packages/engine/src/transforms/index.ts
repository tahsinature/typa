// Import all transform modules to trigger registration
import './json';
import './encoding';
import './hashing';
import './formatting';
import './web';
import './numbers';
import './diff';
import './image-diff';
import './mermaid';
import './code-image';
import './text-stats';
import './image-canvas';
import './port-manager';

// Re-export registry
export {
  registerTransform,
  getTransform,
  getAllTransforms,
  searchTransforms,
  getCategories,
} from './registry';
