import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRepairPatch} from '../src/repair-patch.mjs';
test('repairs only addressed fields and preserves the original model design', () => {
  const source = {scenes:[{nodes:[{text:'Hello',rect:[0,0,100,100]},{text:'World'}]}]};
  const repaired = applyRepairPatch(source,[{op:'replace',path:'/scenes/0/nodes/0/rect/2',value:200}]);
  assert.equal(source.scenes[0].nodes[0].rect[2],100);
  assert.equal(repaired.scenes[0].nodes[0].rect[2],200);
  assert.deepEqual(repaired.scenes[0].nodes[1],source.scenes[0].nodes[1]);
});
test('supports array insertion/removal and escaped pointer keys', () => {
  assert.deepEqual(applyRepairPatch({'a/b':[1,2]},[{op:'add',path:'/a~1b/1',value:3},{op:'remove',path:'/a~1b/0'}]),{'a/b':[3,2]});
});
test('rejects prototype access, nonexistent parents, invalid indices and unbounded repairs', () => {
  for(const operations of [[{op:'add',path:'/__proto__/x',value:1}],[{op:'replace',path:'/missing/x',value:1}],[{op:'replace',path:'/a/01',value:1}],[{op:'remove',path:'/a/2'}],[{op:'move',path:'/a/0'}],Array(17).fill({op:'remove',path:'/a/0'})]) assert.throws(()=>applyRepairPatch({a:[1]},operations));
  assert.equal({}.x,undefined);
});
