// Explicit opt-in integration test: run only against the supplied demo workspace.
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const patchArg=process.argv.indexOf('--patch');
if(!process.argv.includes('--demo') || patchArg<0 || !process.argv[patchArg+1])throw Error('Requires --demo --patch <absolute test patch path>; creates objects only in the verified demo.');
const expectedPatch=path.resolve(process.argv[patchArg+1]).replaceAll('\\','/').toLowerCase();
const child=spawn(process.execPath,[fileURLToPath(new URL('./mcp-server.mjs',import.meta.url))],{stdio:['pipe','pipe','inherit'],windowsHide:true});
let next=0;const pending=new Map();const evidence=[];
readline.createInterface({input:child.stdout}).on('line',line=>{
  const msg=JSON.parse(line);const p=pending.get(msg.id);if(p){clearTimeout(p.timer);pending.delete(msg.id);p.resolve(msg);}
});
function request(method,params){const id=++next;return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP response timeout'));},25000);pending.set(id,{resolve,timer});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
});}
async function tool(name,args={}){
  if(!['max_status','max_inspect','max_reference'].includes(name)) {
    const snapshot=await tool('max_inspect',{session:args.session,scope:args.scope});
    args={...args,expectedRevision:snapshot.result.revision};
  }
  const response=await request('tools/call',{name,arguments:args});
  if(response.error||response.result?.isError)throw Error(JSON.stringify(response));
  const result=JSON.parse(response.result.content[0].text);evidence.push({tool:name,args,result});return result;
}
try {
  assert.ok((await request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'max-live-smoke',version:'1'}})).result);
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  assert.equal((await request('tools/list',{})).result.tools.length,15);
  const {session}=await tool('max_status');const context={session,scope:['workspace']};
  const root=await tool('max_inspect',{session});
  assert.equal(path.resolve(root.result.filepath).replaceAll('\\','/').toLowerCase(),expectedPatch,'Wrong host patch; refusing mutation');
  const initial=await tool('max_inspect',context);
  assert.equal(initial.result.name,'codex_workspace');
  for(const name of ['demoInput','demoDouble','demoOutput','temporaryProbe'])assert.ok(!initial.result.objects.some(o=>o.varname===name),'Demo name already exists; refusing duplicate run');
  const create=async(name,object,args,x,y)=>tool('max_create',{...context,name,object,args,x,y});
  await create('demoInput','number',[],80,130);
  await create('demoDouble','*',[2],80,210);
  await create('demoOutput','number',[],80,290);
  const c1={...context,source:'demoInput',outlet:0,destination:'demoDouble',inlet:0};
  const c2={...context,source:'demoDouble',outlet:0,destination:'demoOutput',inlet:0};
  await tool('max_connect',c1);await tool('max_connect',c2);
  await tool('max_setvalue',{...context,name:'demoInput',value:21});
  let state=await tool('max_inspect',context);
  const value=()=>state.result.objects.find(o=>o.varname==='demoOutput').value;
  assert.equal(Number(value()),42,'Real Max arithmetic propagation');
  await tool('max_move',{...context,name:'demoOutput',x:80,y:310});
  await tool('max_disconnect',c2);
  await tool('max_send',{...context,name:'demoInput',selector:'int',args:[5]});
  state=await tool('max_inspect',context);assert.equal(Number(value()),42,'Disconnected output is unchanged');
  await tool('max_connect',c2);await tool('max_send',{...context,name:'demoInput',selector:'int',args:[21]});
  await create('temporaryProbe','number',[],400,130);await tool('max_remove',{...context,name:'temporaryProbe'});
  state=await tool('max_inspect',context);assert.equal(Number(value()),42);assert.ok(!state.result.objects.some(o=>o.varname==='temporaryProbe'));
  assert.equal(state.result.connections.length,2);
  const stale=await request('tools/call',{name:'max_create',arguments:{...context,session:'stale',name:'mustNotExist',object:'number',args:[],x:0,y:0}});
  assert.equal(stale.result.isError,true);
  const protectedSnapshot=await tool('max_inspect',context);
  const protectedRemoval=await request('tools/call',{name:'max_remove',arguments:{...context,expectedRevision:protectedSnapshot.result.revision,name:'workspaceLabel'}});
  assert.equal(protectedRemoval.result.isError,true);
  state=await tool('max_inspect',context);assert.ok(!state.result.objects.some(o=>o.varname==='mustNotExist'));
  const staleRevision=state.result.revision;
  await tool('max_move',{...context,name:'demoOutput',x:100,y:310});
  const conflict=await request('tools/call',{name:'max_setvalue',arguments:{...context,name:'demoInput',value:999,expectedRevision:staleRevision}});
  assert.equal(conflict.result.isError,true);assert.match(conflict.result.content[0].text,/State conflict/);
  state=await tool('max_inspect',context);assert.equal(Number(value()),42);
  const report={date:new Date().toISOString(),passed:true,transport:'MCP stdio → HTTP → Max node.script → v8',audioTested:false,evidence};
  if(process.env.MAX_TEST_REPORT)fs.writeFileSync(process.env.MAX_TEST_REPORT,JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,operations:evidence.length,controlResult:'21 * 2 = 42',connections:state.result.connections,audioTested:false},null,2));
} finally {child.stdin.end();child.kill();}
