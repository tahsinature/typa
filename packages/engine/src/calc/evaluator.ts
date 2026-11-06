import type { ConversionTarget, Node, PercentRelation } from './ast';
import { isDimensionless } from './dimensions';
import { CONSTANTS, FUNCTIONS, factorial } from './functions';
import {
  CalcError, type Value, num, percent, add, multiply, divide, power, negate, convert, fromDisplay,
  toNumber, displayValue,
} from './values';

export interface EvalScope {
  variables: Map<string, Value>;
  /** Document-level names: prev, sum, line3, today… Returns undefined when unknown. */
  resolveName(name: string): Value | undefined;
  /** Unit or currency spelled on its own, e.g. "km" in "100 / km". */
  resolveUnit(name: string): Value | undefined;
}

export function evaluate(node: Node, scope: EvalScope): Value {
  return new Evaluator(scope).eval(node);
}

class Evaluator {
  constructor(private scope: EvalScope) {}

  eval(node: Node): Value {
    switch (node.type) {
      case 'number': return num(node.value);
      case 'name': return this.name(node.name);
      case 'withUnits': return multiply(this.eval(node.expr), fromDisplay(1, node.units));
      case 'percent': return percent(toNumber(this.eval(node.expr), 'A percentage') / 100);
      case 'factorial': return num(factorial(toNumber(this.eval(node.expr), 'Factorial')));
      case 'negate': return negate(this.eval(node.expr));
      case 'binary': return this.binary(node.op, this.eval(node.left), this.eval(node.right));
      case 'percentOf': return this.percentOf(node.relation, this.eval(node.percent), this.eval(node.base));
      case 'percentWhat': return this.percentWhat(node.relation, this.eval(node.percent), this.eval(node.result));
      case 'asPercent': return this.asPercent(node.relation, this.eval(node.part), this.eval(node.base));
      case 'call': return this.call(node.name, node.args.map((a) => this.eval(a)));
      case 'convert': return this.convert(this.eval(node.expr), node.target);
      case 'assign': return this.assign(node.name, node.op, this.eval(node.expr));
    }
  }

  private name(name: string): Value {
    const variable = this.scope.variables.get(name);
    if (variable) return variable;
    const lower = name.toLowerCase();
    if (name in CONSTANTS) return num(CONSTANTS[name]);
    if (lower in CONSTANTS) return num(CONSTANTS[lower]);
    const value = this.scope.resolveName(name) ?? this.scope.resolveUnit(name);
    if (value) return value;
    throw new CalcError(`Unknown word "${name}"`);
  }

  private binary(op: '+' | '-' | '*' | '/' | '^' | 'mod', a: Value, b: Value): Value {
    switch (op) {
      case '+': return add(a, b);
      case '-': return add(a, b, -1);
      case '*': return multiply(a, b);
      case '/': return divide(a, b);
      case '^': return power(a, b);
      case 'mod': return this.mod(a, b);
    }
  }

  private mod(a: Value, b: Value): Value {
    if (a.kind !== 'quantity' || b.kind !== 'quantity') throw new CalcError('mod needs two numbers');
    const divisor = isDimensionless(b.dims) ? b.value : toNumber(divide(b, fromDisplay(1, a.units)), 'mod');
    if (divisor === 0) throw new CalcError('Division by zero');
    const n = displayValue(a);
    return { ...fromDisplay(((n % divisor) + divisor) % divisor, a.units), format: a.format };
  }

  /** "5% of 30" = 1.5, "5% on 30" = 31.5, "5% off 30" = 28.5, "half of 30" = 15. */
  private percentOf(relation: PercentRelation, p: Value, base: Value): Value {
    if (relation === 'of') return multiply(p, base);
    if (p.kind !== 'percent') throw new CalcError(`"${relation}" needs a percentage before it`);
    return add(base, p, relation === 'on' ? 1 : -1);
  }

  /** "5% of what is 6" = 120. */
  private percentWhat(relation: PercentRelation, p: Value, result: Value): Value {
    const ratio = p.kind === 'percent' ? p.ratio : toNumber(p, 'A percentage');
    const factor = relation === 'of' ? ratio : relation === 'on' ? 1 + ratio : 1 - ratio;
    return divide(result, num(factor));
  }

  /** "50 as a % of 100" = 50%. */
  private asPercent(relation: PercentRelation, part: Value, base: Value): Value {
    const numerator = relation === 'of' ? part : relation === 'on' ? add(part, base, -1) : add(base, part, -1);
    return percent(toNumber(divide(numerator, base), 'A percentage'));
  }

  private call(name: string, args: Value[]): Value {
    const fn = FUNCTIONS[name];
    if (!fn) throw new CalcError(`Unknown function "${name}"`);
    return fn(args);
  }

  private convert(v: Value, target: ConversionTarget): Value {
    switch (target.kind) {
      case 'units':
        // "100 to EUR": a bare number takes the target unit.
        if (v.kind === 'quantity' && !v.units.length && isDimensionless(v.dims)) return fromDisplay(v.value, target.units);
        return convert(v, target.units);
      case 'percent':
        return v.kind === 'percent' ? v : percent(toNumber(v, 'A percentage'));
      case 'unix':
        if (v.kind !== 'date') throw new CalcError('Only dates convert to a unix timestamp');
        return num(Math.floor(v.ms / 1000));
      case 'format': {
        if (v.kind !== 'quantity') throw new CalcError(`Can't show this value in ${target.format}`);
        return { ...v, format: target.format === 'decimal' ? undefined : target.format };
      }
    }
  }

  private assign(name: string, op: '=' | '+' | '-' | '*' | '/', value: Value): Value {
    let result = value;
    if (op !== '=') {
      const current = this.scope.variables.get(name);
      if (!current) throw new CalcError(`"${name}" has no value yet`);
      result = this.binary(op, current, value);
    }
    this.scope.variables.set(name, result);
    return result;
  }
}
