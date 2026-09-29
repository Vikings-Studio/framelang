// Small JSON Patch repairs avoid regenerating a valid design after one lint error.
// This is transport only: repaired programs still require lint/check before render.
export function applyRepairPatch(document, operations) {
  if (!Array.isArray(operations) || operations.length < 1 || operations.length > 16) throw new Error('Expected 1–16 JSON Patch operations');
  const result = JSON.parse(JSON.stringify(document));
  for (const operation of operations) {
    if (!operation || !['add', 'remove', 'replace'].includes(operation.op) || typeof operation.path !== 'string' || !operation.path.startsWith('/')) throw new Error('Expected add/remove/replace with a JSON Pointer');
    if (Object.keys(operation).some(k => !['op', 'path', 'value'].includes(k)) || (operation.op !== 'remove' && !Object.hasOwn(operation, 'value'))) throw new Error('Invalid operation fields');
    const keys = operation.path.slice(1).split('/').map(k => {
      if (/~(?![01])/u.test(k)) throw new Error('Invalid JSON Pointer escape');
      const key = k.replace(/~1/g, '/').replace(/~0/g, '~');
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe property');
      return key;
    });
    let parent = result;
    for (const key of keys.slice(0, -1)) {
      if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, key)) throw new Error('Pointer parent does not exist');
      parent = parent[key];
    }
    const key = keys.at(-1);
    if (!parent || typeof parent !== 'object') throw new Error('Pointer parent is not a container');
    if (Array.isArray(parent)) {
      if (key !== '-' && !/^(0|[1-9]\d*)$/.test(key)) throw new Error('Invalid array index');
      const index = key === '-' ? parent.length : Number(key);
      if (index > parent.length || (operation.op !== 'add' && index >= parent.length)) throw new Error('Array index outside bounds');
      if (operation.op === 'add') parent.splice(index, 0, operation.value);
      else if (operation.op === 'remove') parent.splice(index, 1);
      else parent[index] = operation.value;
    } else {
      if (operation.op !== 'add' && !Object.hasOwn(parent, key)) throw new Error('Pointer target does not exist');
      if (operation.op === 'remove') delete parent[key];
      else parent[key] = operation.value;
    }
  }
  return JSON.parse(JSON.stringify(result));
}
