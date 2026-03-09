import type { Transform } from '../types';

const transforms = new Map<string, Transform>();

export function registerTransform(transform: Transform): void {
  transforms.set(transform.id, transform);
}

export function getTransform(id: string): Transform | undefined {
  return transforms.get(id);
}

export function getAllTransforms(): Transform[] {
  return Array.from(transforms.values());
}

export function searchTransforms(query: string): Transform[] {
  if (!query) return getAllTransforms();
  const lower = query.toLowerCase();
  return getAllTransforms().filter(
    (t) =>
      t.name.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower) ||
      t.category.toLowerCase().includes(lower),
  );
}

export function getCategories(): import('../types').TransformCategory[] {
  const cats = new Set(getAllTransforms().map((t) => t.category));
  return Array.from(cats).sort();
}
