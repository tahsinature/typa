import type { DisplayFormat, UnitTerm } from './values';

export type PercentRelation = 'of' | 'on' | 'off';

export type ConversionTarget =
  | { kind: 'units'; units: UnitTerm[] }
  | { kind: 'format'; format: DisplayFormat | 'decimal' }
  | { kind: 'percent' }
  | { kind: 'unix' };

export type Node =
  | { type: 'number'; value: number }
  | { type: 'name'; name: string }
  | { type: 'withUnits'; expr: Node; units: UnitTerm[] }
  | { type: 'percent'; expr: Node }
  | { type: 'factorial'; expr: Node }
  | { type: 'negate'; expr: Node }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '^' | 'mod'; left: Node; right: Node }
  /** "5% of 30", "5% on 30", "5% off 30". */
  | { type: 'percentOf'; relation: PercentRelation; percent: Node; base: Node }
  /** "5% of what is 6": finds the base. */
  | { type: 'percentWhat'; relation: PercentRelation; percent: Node; result: Node }
  /** "50 as a % of 100": finds the percentage. */
  | { type: 'asPercent'; relation: PercentRelation; part: Node; base: Node }
  | { type: 'call'; name: string; args: Node[] }
  | { type: 'convert'; expr: Node; target: ConversionTarget }
  | { type: 'assign'; name: string; op: '=' | '+' | '-' | '*' | '/'; expr: Node };
