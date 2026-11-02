// Explicit maintenance of an existing bridge. Never edits a user's .maxpat file.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
if(!process.argv.includes('--apply')||!option('--patch'))throw Error('Requires --apply --patch <full path of connected host>');
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.resolve(option('--skill-dir')||path.join(os.homedir(),'.codex','skills','max-msp-windows'));
if(source===target)throw Error('Run this updater from a separate repository checkout');
const expected=path.resolve(option('--patch')).replaceAll('\\','/').toLowerCase();
const port=Number(process.env.MAX_BRIDGE_PORT||8711);
const statePath=process.env.MAX_BRIDGE_STATE||path.join(process.platform==='win32'?path.join(os.homedir(),'AppData','Local','Temp'):os.tmpdir(),`codex-max-bridge-${port}.json`);
async function transport(method,args) {
  const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
  if(state.port!==port)throw Error('Port mismatch');
  const response=await fetch(`http://127.0.0.1:${port}/${method?'call':'status'}`,{
    method:method?'POST':'GET',headers:{Authorization:`Bearer ${state.token}`,'Content-Type':'application/json'},
    ...(method?{body:JSON.stringify({id:crypto.randomUUID(),session:state.session,method,args})}:{}),signal:AbortSignal.timeout(10000)});
  const result=await response.json();
  if(!response.ok||result.ok===false)throw Error(result.error||`HTTP ${response.status}`);
  return result;
}
function graph(state) {
  const description=o=>JSON.stringify({name:o.varname,text:o.text,type:o.maxclass,rect:o.rect});
  const byId=new Map(state.objects.map(o=>[o.id,description(o)]));
  return {objects:state.objects.map(description).sort(),connections:state.connections.map(c=>JSON.stringify([byId.get(c.sourceId),c.outlet,byId.get(c.destinationId),c.inlet])).sort()};
}
const status=await transport();
if(Array.isArray(status.pending)?status.pending.length:status.pending)throw Error('Bridge has pending operations; finish/reconcile them before updating');
const before=(await transport('inspect',{scope:[]})).result;
assert.equal(path.resolve(before.filepath).replaceAll('\\','/').toLowerCase(),expected,'Wrong connected host');
const backup=path.join(os.homedir(),'.codex','backups','max-msp-windows',new Date().toISOString().replaceAll(':','-'));
fs.mkdirSync(path.dirname(backup),{recursive:true});
fs.cpSync(target,backup,{recursive:true,errorOnExist:true,force:false});
console.log(JSON.stringify({backup,phase:'backed-up'}));
// Receiver goes last: its autowatch reload must see the complete new runtime.
for(const item of ['scripts','references','agents','SKILL.md'])fs.cpSync(path.join(source,item),path.join(target,item),{recursive:true});
for(const item of fs.readdirSync(path.join(source,'bridge'))) {
  if(item==='max-receiver.js')continue;
  fs.cpSync(path.join(source,'bridge',item),path.join(target,'bridge',item),{recursive:true});
}
fs.copyFileSync(path.join(source,'bridge','max-receiver.js'),path.join(target,'bridge','max-receiver.js'));
let current;
for(let attempt=0;attempt<40;attempt++) {
  await new Promise(resolve=>setTimeout(resolve,150));
  current=(await transport('inspect',{scope:[]})).result;
  if(current.receiverVersion==='0.3.0')break;
}
if(current?.receiverVersion!=='0.3.0')throw Error('Receiver did not reload; backup retained. No UI fallback performed.');
assert.equal(path.resolve(current.filepath).replaceAll('\\','/').toLowerCase(),expected);
// Uses the old transport's supported method, with an explicit receiver maintenance flag.
await transport('send',{scope:[],bridgeRestart:true,expectedRevision:current.revision});
let connected;
for(let attempt=0;attempt<50;attempt++) {
  await new Promise(resolve=>setTimeout(resolve,200));
  try {connected=await transport();if(connected.version==='0.3.0'&&connected.session!==status.session)break;} catch {}
}
if(connected?.version!=='0.3.0'||connected.session===status.session)throw Error('Bridge restart was not verified; backup retained. No UI fallback performed.');
const after=(await transport('inspect',{scope:[]})).result;
assert.equal(path.resolve(after.filepath).replaceAll('\\','/').toLowerCase(),expected);
const unchanged=JSON.stringify(graph(before))===JSON.stringify(graph(after));
console.log(JSON.stringify({upgraded:true,version:connected.version,patch:after.filepath,graphUnchanged:unchanged,backup,
  note:unchanged?'Host objects and wiring preserved. Reload the Codex MCP client to discover new tools.':'Graph changed during maintenance; inspect before editing. No project file was written.'}));
