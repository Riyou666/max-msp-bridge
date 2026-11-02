import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import consoleLog from './console-log.cjs';

test('console tail is bounded, filterable and preserves the source log',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'max-console-test-'));
  const filename=path.join(directory,'console.txt');
  try {
    const original='\uFEFFold\r\nerror: one\r\nordinary\r\nerror: two\r\n';
    fs.writeFileSync(filename,original);
    assert.deepEqual(consoleLog.readConsoleTail(filename,{limit:1,contains:'error:'}).lines,['error: two']);
    assert.equal(consoleLog.readConsoleTail(filename,{limit:1}).truncated,true);
    assert.equal(fs.readFileSync(filename,'utf8'),original);
    assert.throws(()=>consoleLog.readConsoleTail(filename,{limit:501}),/1..500/);
    fs.writeFileSync(filename,'x'.repeat(1100000)+'\nlast line\n');
    const result=consoleLog.readConsoleTail(filename);
    assert.deepEqual(result.lines,['last line']);assert.equal(result.truncated,true);
  } finally {fs.rmSync(directory,{recursive:true});}
});
