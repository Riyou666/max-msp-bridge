import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validate(document) {
  const findings = [];
  const add = (scope, rule, detail) => findings.push({scope, rule, detail});
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  function walk(p, scope) {
    if (!object(p) || !Array.isArray(p.boxes) || !Array.isArray(p.lines)) {
      add(scope, 'patcher_shape', 'Expected patcher with boxes and lines arrays'); return;
    }
    const boxes = new Map();
    for (const entry of p.boxes) {
      const b = entry?.box;
      if (!object(b) || typeof b.id !== 'string' || !b.id) { add(scope, 'box_shape', 'Missing box/id'); continue; }
      if (boxes.has(b.id)) add(scope, 'duplicate_id', b.id);
      boxes.set(b.id, b);
      if (typeof b.maxclass !== 'string' || !b.maxclass) add(scope, 'maxclass', b.id);
      for (const key of ['numinlets','numoutlets']) if (key in b && (!Number.isInteger(b[key]) || b[key] < 0)) add(scope, 'port_count', `${b.id}.${key}`);
      if (b.patching_rect && (!Array.isArray(b.patching_rect) || b.patching_rect.length !== 4 || !b.patching_rect.every(Number.isFinite))) add(scope, 'rectangle', b.id);
      if ('patcher' in b) walk(b.patcher, `${scope}/${b.id}`);
    }
    for (const entry of p.lines) {
      const line = entry?.patchline;
      if (!object(line)) { add(scope, 'line_shape', 'Missing patchline'); continue; }
      for (const [side, count] of [['source','numoutlets'],['destination','numinlets']]) {
        const endpoint = line[side];
        if (!Array.isArray(endpoint) || endpoint.length !== 2 || typeof endpoint[0] !== 'string' || !Number.isInteger(endpoint[1]) || endpoint[1] < 0) { add(scope, 'endpoint_shape', side); continue; }
        const b = boxes.get(endpoint[0]);
        if (!b) add(scope, 'dangling_endpoint', `${side}: ${endpoint[0]}`);
        else if (Number.isInteger(b[count]) && endpoint[1] >= b[count]) add(scope, 'port_bounds', `${side}: ${endpoint.join(':')}`);
      }
      if ('order' in line && (!Number.isInteger(line.order) || line.order < 0)) add(scope, 'line_order', String(line.order));
    }
  }
  walk(document?.patcher, 'root');
  return {ok: findings.length === 0, findings, coverage: 'JSON structure and declared port bounds only; no DSP/object/runtime validation'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] !== 'validate' || !process.argv[3]) throw Error('Usage: node maxpat.mjs validate patch.maxpat');
    const result = validate(JSON.parse(fs.readFileSync(process.argv[3], 'utf8').replace(/^\uFEFF/, '')));
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
