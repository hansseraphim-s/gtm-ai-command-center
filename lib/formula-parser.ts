/**
 * Safe arithmetic expression evaluator.
 * Supports: numbers, +, -, *, /, parentheses, unary minus.
 * Does NOT use eval() or Function().
 * Variables are substituted before parsing; any remaining non-arithmetic
 * tokens cause an error rather than being silently ignored.
 */

export function evaluateFormula(
  formula: string,
  params: Record<string, number>,
  measuredValue = 0
): number {
  const vars: Record<string, number> = { ...params, measured_value: measuredValue };

  // Substitute variables longest-first to avoid partial matches
  let expr = formula;
  const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const re = new RegExp(`\\b${key}\\b`, 'g');
    expr = expr.replace(re, String(vars[key]));
  }

  // After substitution, only digits, decimal points, spaces, and arithmetic ops are valid
  if (!/^[\d\s+\-*/.()]+$/.test(expr)) {
    throw new Error(
      `Formula "${formula}" contains unresolved or invalid tokens after variable substitution. ` +
        `Result was: "${expr}"`
    );
  }

  const tokens = tokenize(expr);
  let pos = 0;

  function parseExpr(): number {
    let left = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const right = parseFactor();
      if (op === '/' && right === 0) throw new Error('Division by zero in formula');
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number {
    if (tokens[pos] === '(') {
      pos++;
      const val = parseExpr();
      if (tokens[pos] !== ')') throw new Error('Mismatched parentheses in formula');
      pos++;
      return val;
    }
    if (tokens[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (tokens[pos] === undefined) throw new Error('Unexpected end of formula');
    const n = parseFloat(tokens[pos++]);
    if (isNaN(n)) throw new Error(`Expected number, got "${tokens[pos - 1]}"`);
    return n;
  }

  const result = parseExpr();
  if (pos !== tokens.length) {
    throw new Error(`Unexpected token "${tokens[pos]}" in formula`);
  }
  return result;
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }
    if (/[0-9.]/.test(expr[i])) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push(num);
    } else {
      tokens.push(expr[i++]);
    }
  }
  return tokens;
}
