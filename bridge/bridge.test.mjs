import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {rpc,tools,callTool} from './mcp-server.mjs';
import {validate} from '../scripts/maxpat.mjs';

test('MCP initialization, tool discovery, notifications and unknown method',async()=>{
  assert.equal((await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05'}})).result.protocolVersion,'2024-11-05');
  assert.equal((await rpc({jsonrpc:'2.0',id:2,method:'tools/list'})).result.tools.length,10);
  assert.equal(await rpc({jsonrpc:'2.0',method:'notifications/initialized'}),null);
  assert.equal((await rpc({jsonrpc:'2.0',id:3,method:'unknown'})).error.code,-32601);
  assert.equal(new Set(tools.map(t=>t.name)).size,10);
});
test('invalid mutation arguments fail before contacting bridge',async()=>{
  const r=await rpc({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'max_create',arguments:{session:'x'}}});
  assert.equal(r.result.isError,true);assert.match(r.result.content[0].text,/Missing argument/);
});
test('recursive structure validation catches nested dangling cords without mutation',()=>{
  const d={patcher:{boxes:[{box:{id:'p',maxclass:'newobj',patcher:{boxes:[],lines:[{patchline:{source:['missing',0],destination:['missing',0]}}]}}}],lines:[]}};
  const before=JSON.stringify(d);const r=validate(d);
  assert.equal(r.ok,false);assert.equal(r.findings[0].scope,'root/p');assert.equal(JSON.stringify(d),before);
});
test('scope local IDs are valid; boolean/negative/out of bounds ports are rejected',()=>{
  const b={box:{id:'a',maxclass:'number',numinlets:1,numoutlets:1}};
  const d={patcher:{boxes:[structuredClone(b),{box:{id:'p',maxclass:'newobj',patcher:{boxes:[structuredClone(b)],lines:[]}}}],lines:[]}};
  assert.equal(validate(d).ok,true);
  for(const n of [true,-1,1]){d.patcher.lines=[{patchline:{source:['a',n],destination:['a',0]}}];assert.equal(validate(d).ok,false);}
});
test('receiver rejects expired requests without touching patcher',()=>{
  let reply; const context={outlet:(_i,_s,text)=>{reply=JSON.parse(text);}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('./max-receiver.js',import.meta.url),'utf8'),context);
  context.request(JSON.stringify({id:'old',method:'create',args:{},deadline:0}));
  assert.equal(reply.ok,false);assert.match(reply.error,/Expired/);
});

test('mixed old bridge and new client rejects writes before network access',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'max-version-test-'));
  const previous=process.env.MAX_BRIDGE_STATE;
  try {
    process.env.MAX_BRIDGE_STATE=path.join(folder,'state.json');
    fs.writeFileSync(process.env.MAX_BRIDGE_STATE,JSON.stringify({port:Number(process.env.MAX_BRIDGE_PORT||8711),session:'test',token:'fake-test-token'}));
    await assert.rejects(()=>callTool('max_move',{session:'test',name:'a',x:0,y:0,expectedRevision:'old'}),/version mismatch/);
  } finally {
    if(previous===undefined)delete process.env.MAX_BRIDGE_STATE;else process.env.MAX_BRIDGE_STATE=previous;
    fs.rmSync(folder,{recursive:true});
  }
});
