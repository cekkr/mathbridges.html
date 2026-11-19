// Deliberately small expression grammar: no assignments, scripts, arbitrary calls, or eval.
const FUNCTIONS = new Set(['sqrt', 'sin', 'cos', 'tan', 'exp', 'log']);
export function parseExpression(input, variable = 'x') {
  if (!['x', 'y', 'z', 't'].includes(variable)) throw new Error('invalid');
  if (!input || input.length > 180) throw new Error(input?.length > 180 ? 'tooComplex' : 'invalid');
  const source = input.replaceAll('−', '-').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('**', '^');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[a-z]+|[()+\-*/^]/g) || [];
  if (tokens.join('') !== source.replace(/\s/g, '') || tokens.length > 100) throw new Error('invalid');
  let at = 0;
  function primary() {
    const token = tokens[at++];
    if (token === '(') {
      const result = sum();
      if (tokens[at++] !== ')') throw new Error('invalid');
      return result;
    }
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token || '')) {
      if (Number(token) > 1e6) throw new Error('tooComplex');
      return { type: 'number', value: token };
    }
    if ([variable, 'pi', 'e', 'i'].includes(token)) return { type: 'symbol', value: token };
    if (FUNCTIONS.has(token)) {
      if (tokens[at++] !== '(') throw new Error('invalid');
      const arg = sum();
      if (tokens[at++] !== ')') throw new Error('invalid');
      return { type: 'call', name: token, arg };
    }
    throw new Error('invalid');
  }
  function power() {
    let result = primary();
    if (tokens[at] === '^') {
      at++;
      let sign = 1;
      if (tokens[at] === '-') { sign = -1; at++; }
      // Integer exponents only, bounded to avoid enormous symbolic expansions.
      const value = tokens[at++];
      if (!/^\d+$/.test(value || '') || Number(value) > 8) throw new Error('tooComplex');
      result = { type: 'binary', op: '^', left: result, right: { type: 'number', value: String(sign * Number(value)) } };
      if (tokens[at] === '^') throw new Error('tooComplex');
    }
    return result;
  }
  function unary() {
    if (tokens[at] === '+' || tokens[at] === '-') {
      const op = tokens[at++]; return { type: 'unary', op, arg: unary() };
    }
    return power();
  }
  function product() {
    let result = unary();
    while (tokens[at] === '*' || tokens[at] === '/') {
      const op = tokens[at++]; result = { type: 'binary', op, left: result, right: unary() };
    }
    return result;
  }
  function sum() {
    let result = product();
    while (tokens[at] === '+' || tokens[at] === '-') {
      const op = tokens[at++]; result = { type: 'binary', op, left: result, right: product() };
    }
    return result;
  }
  const ast = sum();
  if (at !== tokens.length) throw new Error('invalid');
  return ast;
}
export function serialize(ast) {
  if (ast.type === 'number' && ast.value.includes('.')) {
    const [whole, fraction = ''] = ast.value.split('.');
    return `(${BigInt((whole || '0') + fraction)}/${10n ** BigInt(fraction.length)})`;
  }
  if (ast.type === 'number' || ast.type === 'symbol') return ast.value;
  if (ast.type === 'call') return `${ast.name}(${serialize(ast.arg)})`;
  if (ast.type === 'unary') return `(${ast.op}${serialize(ast.arg)})`;
  return `(${serialize(ast.left)}${ast.op}${serialize(ast.right)})`;
}
export function domainRestrictions(ast, domain = 'real') {
  const found = [];
  function walk(node) {
    if (node.type === 'binary') {
      if (node.op === '/') found.push({ expression: serialize(node.right), relation: 'neq' });
      if (node.op === '^' && Number(node.right.value) < 0) found.push({ expression: serialize(node.left), relation: 'neq' });
      walk(node.left); walk(node.right);
    } else if (node.type === 'call') {
      if (node.name === 'sqrt' && domain === 'real') found.push({ expression: serialize(node.arg), relation: 'gte' });
      if (node.name === 'log') found.push({ expression: serialize(node.arg), relation: domain === 'real' ? 'gt' : 'neq' });
      if (node.name === 'tan') found.push({ expression: `cos(${serialize(node.arg)})`, relation: 'neq' });
      walk(node.arg);
    } else if (node.type === 'unary') walk(node.arg);
  }
  walk(ast);
  return found;
}
function splitRoots(s) {
  if (!s.startsWith('[')) return [s];
  const values = []; let depth = 0, start = 1;
  for (let j = 1; j < s.length - 1; j++) {
    if ('(['.includes(s[j])) depth++;
    if (')]'.includes(s[j])) depth--;
    if (s[j] === ',' && depth === 0) { values.push(s.slice(start, j)); start = j + 1; }
  }
  values.push(s.slice(start, -1)); return values.filter(Boolean);
}
export function analyzeEquation(engine, { equation, variable = 'x', domain = 'real' }) {
  const sides = equation.split('=');
  if (sides.length !== 2 || !['real', 'complex'].includes(domain)) throw new Error('invalid');
  const [left, right] = sides.map(s => parseExpression(s.trim(), variable));
  const lhs = serialize(left), rhs = serialize(right);
  const run = expr => {
    const result = engine.run(expr).trim();
    if (!result || /Stop:|Error|undefined|NaN|Infinity/.test(result)) throw new Error('workerError');
    return result;
  };
  // quote keeps a factored form from automatically expanding when rendered.
  const tex = expr => run(`printlatex(quote(${expr}))`).replace(/^"|"$/g, '');
  const result = { steps: [], suggestedIds: [], roots: [], restrictions: [...domainRestrictions(left, domain), ...domainRestrictions(right, domain)], status: 'unsupported' };
  for (const r of result.restrictions) r.latex = tex(r.expression);
  const add = id => { if (!result.suggestedIds.includes(id)) result.suggestedIds.push(id); };
  const step = (key, expression) => result.steps.push({ key, latex: tex(expression) });
  const variablePattern = new RegExp(`\\b${variable}\\b`);
  function polynomial(expr) {
    const expanded = run(`expand(${expr})`);
    const degree = Number(run(`deg(${expanded},${variable})`));
    if (!Number.isInteger(degree) || degree < 0 || degree > 4) return null;
    const coefficients = Array.from({ length: degree + 1 }, (_, j) => run(`coeff(${expanded},${variable},${j})`));
    if (coefficients.some(c => variablePattern.test(c))) return null;
    const reconstructed = coefficients.map((c, j) => `((${c})*${variable}^${j})`).join('+');
    if (run(`simplify((${expanded})-(${reconstructed}))`) !== '0') return null;
    return { expression: expanded, degree, coefficients };
  }
  let expression = run(`simplify((${lhs})-(${rhs}))`);
  step('stepNormalize', expression);
  const calls = [...equation.matchAll(/\b(sin|cos|tan|exp|log|sqrt)\s*\(/g)].map(x => x[1]);
  if (calls.includes('sin') || calls.includes('cos') || calls.includes('tan')) add('B-04.11');
  if (result.restrictions.some(r => r.relation === 'neq')) add('B-02.04');
  if (calls.length) { add('B-02.07'); add('B-12.02'); }
  if (expression === '0') { result.status = 'identity'; return result; }
  // Only sqrt(P(x)) = Q(x), or its reverse, is squared automatically.
  const radical = left.type === 'call' && left.name === 'sqrt' ? left : right.type === 'call' && right.name === 'sqrt' ? right : null;
  if (radical) {
    const other = radical === left ? right : left;
    const p = polynomial(serialize(radical.arg)), q = polynomial(serialize(other));
    if (p && q && q.degree <= 1) {
      expression = run(`expand((${serialize(radical.arg)})-(${serialize(other)})^2)`);
      step('stepSquare', expression); add('B-02.06');
    }
  }
  const numerator = run(`numerator(${expression})`);
  const poly = polynomial(numerator);
  if (!poly) { add('B-12.11'); return result; }
  if (poly.degree === 0) { result.status = poly.expression === '0' ? 'unsupported' : 'contradiction'; return result; }
  const factored = run(`factor(${poly.expression},${variable})`);
  step('stepFactor', factored); add('B-02.01');
  if (poly.degree === 1) { step('stepLinear', run(`-(${poly.coefficients[0]})/(${poly.coefficients[1]})`)); add('B-02.02'); }
  if (poly.degree === 2) {
    const [c, b, a] = poly.coefficients;
    const discriminant = run(`(${b})^2-4*(${a})*(${c})`);
    result.discriminant = tex(discriminant);
    result.steps.push({ key: 'stepQuadratic', latex: `${variable}=\\frac{-(${tex(b)})\\pm\\sqrt{${tex(discriminant)}}}{2(${tex(a)})}` });
    add('B-02.03');
    const d = Number(run(`float(${discriminant})`));
    if (d < 0) add('B-01.04');
  }
  if (poly.degree === 4 && poly.coefficients[1] === '0' && poly.coefficients[3] === '0') {
    result.steps.push({ key: 'stepSubstitution', latex: `u=${variable}^2` }); add('B-02.07');
  }
  step('stepRoots', poly.expression);
  const roots = splitRoots(run(`roots(${poly.expression},${variable})`));
  if (roots.some(r => /roots\(|Stop:/.test(r))) { add('B-12.11'); return result; }
  add('B-12.11');
  // Certify signs only when exact symbolic reduction gives a rational number.
  // Floating-point estimates must not promote an unknown domain guard to true.
  function rationalSign(value) {
    const match = /^(-?\d+)(?:\/(\d+))?$/.exec(value);
    if (!match) return null;
    const numerator = BigInt(match[1]);
    return numerator === 0n ? 0 : numerator > 0n ? 1 : -1;
  }
  function nonzeroProof(value) {
    const sign = rationalSign(value);
    if (sign !== null) return sign === 0 ? false : true;
    const squaredMagnitude = run(`simplify(real(${value})^2+imag(${value})^2)`);
    const squaredSign = rationalSign(squaredMagnitude);
    return squaredSign === null ? null : squaredSign > 0;
  }
  function checkRestriction(restriction, root) {
    try {
      const value = run(`simplify(subst((${root}),${variable},(${restriction.expression})))`);
      if (value === '0') return restriction.relation === 'gte' ? 'verified' : 'rejected';
      if (restriction.relation === 'neq') {
        const proof = nonzeroProof(value);
        return proof === true ? 'verified' : proof === false ? 'rejected' : 'unknown';
      }
      const sign = rationalSign(value);
      return sign === 1 ? 'verified' : sign === -1 ? 'rejected' : 'unknown';
    } catch { return 'rejected'; }
  }
  for (const root of [...new Set(roots)]) {
    let state = 'verified', residual = '', imaginary;
    try {
      imaginary = run(`simplify(imag(${root}))`);
      if (domain === 'real' && imaginary !== '0') {
        state = nonzeroProof(imaginary) === true ? 'rejected' : 'unknown';
      }
      const checks = result.restrictions.map(r => checkRestriction(r, root));
      if (checks.includes('rejected')) state = 'rejected';
      else if (checks.includes('unknown') && state !== 'rejected') state = 'unknown';
      residual = run(`simplify(subst((${root}),${variable},((${lhs})-(${rhs}))))`);
      if (residual !== '0' && state !== 'rejected') {
        state = nonzeroProof(residual) === true ? 'rejected' : 'unknown';
      }
    } catch { state = 'rejected'; }
    result.roots.push({ expression: root, latex: tex(root), state, residualLatex: residual ? tex(residual) : null });
  }
  for (const r of result.restrictions) r.latex = tex(r.expression);
  result.status = result.roots.some(r => r.state === 'unknown') ? 'partial' : result.roots.some(r => r.state === 'verified') ? 'solved' : 'emptyRoots';
  return result;
}
