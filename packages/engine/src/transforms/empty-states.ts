import type { TransformEmptyState } from '../types';

export const jsonEmptyState: TransformEmptyState = {
  title: 'Ready for JSON',
  description: 'Paste or type JSON on the left to see the result.',
  symbol: '{ }',
  trimWhitespace: true,
};

export const textEmptyState: TransformEmptyState = {
  title: 'Ready for text',
  description: 'Paste or type text on the left to see the result.',
  symbol: 'Aa',
};

export const numberEmptyState: TransformEmptyState = {
  title: 'Ready for numbers',
  description: 'Enter one number per line to convert it.',
  symbol: '123',
};
