import Algebrite from 'algebrite';
import { analyzeEquation } from './equation.mjs';
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: analyzeEquation(Algebrite, data) }); }
  catch (error) { self.postMessage({ error: ['invalid', 'tooComplex'].includes(error.message) ? error.message : 'workerError' }); }
};
