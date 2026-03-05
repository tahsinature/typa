// Import all transform modules to trigger registration
import './json';
import './encoding';
import './hashing';
import './formatting';
import './web';
import './numbers';

// Re-export registry
export {
  registerTransform,
  getTransform,
  getAllTransforms,
  searchTransforms,
  getCategories,
} from './registry';
