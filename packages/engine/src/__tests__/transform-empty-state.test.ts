import { describe, expect, it } from 'vitest';
import { getAllTransforms, getTransform, getTransformEmptyState } from '../transforms';

describe('transform empty-input policy', () => {
  it.each([
    'json-format', 'json-minify', 'json-normalize', 'json-validate', 'json-multi-view', 'js-to-json',
    'json-to-querystring', 'querystring-to-json', 'jwt-decode', 'timestamp-to-date', 'date-to-timestamp',
    'markdown-table', 'phone-format',
  ])('%s waits for meaningful input instead of reporting an initial error', (id) => {
    const transform = getTransform(id)!;
    expect(getTransformEmptyState(transform, [''])).toBe(transform.emptyState);
    expect(getTransformEmptyState(transform, [' \t\n'])).toBe(transform.emptyState);
    expect(getTransformEmptyState(transform, ['invalid input'])).toBeUndefined();
  });

  it.each(['uppercase', 'sort-lines-asc', 'trim-lines', 'base64-encode', 'url-encode', 'html-encode', 'unicode-escape', 'decimal-to-hex'])(
    '%s preserves whitespace as real input', (id) => {
      const transform = getTransform(id)!;
      expect(getTransformEmptyState(transform, [''])).toBeDefined();
      expect(getTransformEmptyState(transform, [' \n\t'])).toBeUndefined();
    },
  );

  it.each(['json-format', 'decimal-to-hex', 'timestamp-to-date'])(
    '%s accepts zero as input', (id) => {
      expect(getTransformEmptyState(getTransform(id), ['0'])).toBeUndefined();
    },
  );

  it('does not treat false or null JSON as empty', () => {
    for (const input of ['false', 'null']) {
      expect(getTransformEmptyState(getTransform('json-format'), [input])).toBeUndefined();
    }
  });

  it.each(['sha1', 'sha256', 'sha384', 'sha512', 'text-stats', 'generate-uuid', 'text-diff', 'ratio-proportion', 'port-manager', 'process-manager'])(
    '%s keeps its meaningful empty-input behavior', (id) => {
      expect(getTransformEmptyState(getTransform(id), ['', ''])).toBeUndefined();
    },
  );

  it.each(['mermaid-preview', 'code-to-image', 'text-finder', 'find-duplicates', 'present', 'image-diff', 'image-canvas', 'image-inspector', 'hierarchy-tree'])(
    '%s keeps its own viewer and empty state', (id) => {
      expect(getTransformEmptyState(getTransform(id), [''])).toBeUndefined();
    },
  );

  it('keeps comparing text against an empty side', async () => {
    const transform = getTransform('text-diff')!;
    expect(getTransformEmptyState(transform, ['', 'hello'])).toBeUndefined();
    expect(await transform.fn('', 'hello')).toContain('+hello');
  });

  it('does not change parser errors or valid engine results', async () => {
    expect(() => getTransform('json-to-querystring')!.fn('{')).toThrow();
    expect(() => getTransform('markdown-table')!.fn('invalid')).toThrow();
    expect(await getTransform('json-format')!.fn('0')).toBe('0');
    expect(await getTransform('url-encode')!.fn(' \t')).toBe('%20%09');
  });

  it('requires explicit metadata for the shared empty state', () => {
    for (const transform of getAllTransforms()) {
      expect(getTransformEmptyState(transform, [''])).toBe(transform.emptyState);
      expect(getTransformEmptyState(transform, ['some input'])).toBeUndefined();
    }
  });
});
