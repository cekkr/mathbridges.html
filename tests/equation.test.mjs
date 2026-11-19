import test from 'node:test';
import assert from 'node:assert/strict';
import Algebrite from 'algebrite';
import {analyzeEquation,parseExpression,serialize,domainRestrictions} from '../src/scripts/equation.mjs';
const solve=(equation,domain='real',variable='x')=>analyzeEquation(Algebrite,{equation,domain,variable});
const accepted=r=>r.roots.filter(c=>c.state==='verified').map(c=>c.expression);

test('quadratic roots are verified in the original equation',()=>{
 const r=solve('x^2-5*x+6=0');assert.deepEqual(accepted(r),['2','3']);assert.equal(r.status,'solved');
 assert.ok(r.steps.find(s=>s.key==='stepFactor').latex.includes('x-3'));
});
test('linear equation explains isolation',()=>{const r=solve('3*x+6=0');assert.deepEqual(accepted(r),['-2']);assert.ok(r.steps.some(s=>s.key==='stepLinear'));});
test('factorization preserves a zero root',()=>assert.deepEqual(accepted(solve('x^2=2*x')),['0','2']));
test('rational cancellation preserves the original hole',()=>{
 const r=solve('(x^2-1)/(x-1)=0');assert.deepEqual(accepted(r),['-1']);assert.equal(r.restrictions[0].expression,'(x-1)');
});
test('an excluded candidate is rejected even if the simplified residual is zero',()=>{
 const r=solve('(x-1)^2/(x-1)=0');assert.equal(r.status,'emptyRoots');assert.equal(r.roots[0].state,'rejected');
});
test('an identity retains its denominator restriction',()=>{
 const r=solve('x/x=1');assert.equal(r.status,'identity');assert.equal(r.restrictions[0].relation,'neq');assert.equal(r.restrictions[0].latex,'x');
});
test('constant contradiction',()=>assert.equal(solve('x-x=1').status,'contradiction'));
test('squaring introduces a candidate that original substitution rejects',()=>{
 const r=solve('sqrt(x+2)=x');assert.deepEqual(accepted(r),['2']);assert.equal(r.roots.find(c=>c.expression==='-1').state,'rejected');
 assert.ok(r.suggestedIds.includes('B-02.06'));assert.equal(r.restrictions[0].relation,'gte');
});
test('radical equality can be written in either direction',()=>assert.deepEqual(accepted(solve('x=sqrt(x+2)')),['2']));
test('a squared identity is not mistaken for an original identity',()=>assert.equal(solve('sqrt(x^2)=x').status,'unsupported'));
test('biquadratic substitution keeps all four roots',()=>assert.deepEqual(accepted(solve('x^4-5*x^2+4=0')),['-2','-1','1','2']));
test('negative discriminant has no real roots and suggests complex extension',()=>{
 const r=solve('x^2+9=0');assert.equal(r.status,'emptyRoots');assert.ok(r.suggestedIds.includes('B-01.04'));assert.deepEqual(accepted(r),[]);
});
test('complex domain verifies both imaginary roots',()=>assert.deepEqual(accepted(solve('x^2+9=0','complex')),['-3*i','3*i']));
test('a non-x variable is supported',()=>assert.deepEqual(accepted(solve('2*y+6=0','real','y')),['-3']));
test('decimal inputs use exact rational arithmetic',()=>assert.deepEqual(accepted(solve('0.1*x=0.3')),['3']));
test('an unreduced algebraic domain guard remains uncertified despite a numerical sign estimate',()=>{
 const r=solve('(x^2-2)/(x-1)=0');assert.equal(r.status,'partial');assert.ok(r.roots.every(c=>c.state==='unknown'));
});
test('unsupported transcendental forms give suggestions without claiming roots',()=>{
 const r=solve('sin(x)=0');assert.equal(r.status,'unsupported');assert.equal(r.roots.length,0);assert.ok(r.suggestedIds.includes('B-04.11'));
});
test('high-degree polynomials remain suggestions only',()=>assert.equal(solve('x^5-x+1=0').status,'unsupported'));
test('original function restrictions are retained',()=>{
 const ast=parseExpression('log(x)+sqrt(x-1)+tan(x)');const restrictions=domainRestrictions(ast);
 assert.deepEqual(restrictions.map(c=>c.relation),['gt','gte','neq']);
});
test('unary minus has standard precedence',()=>assert.equal(serialize(parseExpression('-x^2')),'(-(x^2))'));
test('arbitrary CAS calls, commands, extra variables and implicit multiplication are rejected',()=>{
 for(const equation of ['x=1;clearall()','roots(x)=0','x+y=0','x=1=2','2x=0','x=window','x^x=1','x^2^8=1'])assert.throws(()=>solve(equation),/invalid|tooComplex/);
});
test('expression and exponent limits bound symbolic input',()=>{
 assert.throws(()=>parseExpression('9'.repeat(181)),/tooComplex/);assert.throws(()=>parseExpression('x^10000'),/tooComplex/);
});
