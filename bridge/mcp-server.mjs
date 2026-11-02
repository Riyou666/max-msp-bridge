import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';
const exec=promisify(execFile);
const here=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.MAX_BRIDGE_PORT||8711);
const str={type:'string'}; const num={type:'number'}; const atoms={type:'array',items:{type:['string','number']},maxItems:64};
const common={session:str,scope:{type:'array',items:str,maxItems:12}};
const definitions=[
  ['max_status','Read session, pending operations and recent request outcomes. No patch mutation.',{},[],true],
  ['max_inspect','Read graph IDs and a single-use revision. Also reconciles expired pending requests after successful readback.',{...common},['session'],true],
  ['max_create','Create one named Max object at coordinates. Object initialization may have side effects.',{...common,name:str,object:str,args:atoms,x:num,y:num},['session','name','object','args','x','y']],
  ['max_connect','Connect objects by ID or unique varname and verify the actual patchcord.',{...common,source:str,sourceId:str,outlet:{type:'integer',minimum:0},destination:str,destinationId:str,inlet:{type:'integer',minimum:0}},['session','outlet','inlet']],
  ['max_disconnect','Disconnect a specific patchcord and verify it.',{...common,source:str,sourceId:str,outlet:{type:'integer',minimum:0},destination:str,destinationId:str,inlet:{type:'integer',minimum:0}},['session','outlet','inlet']],
  ['max_move','Move one object, preserving its dimensions.',{...common,name:str,objectId:str,x:num,y:num},['session','x','y']],
  ['max_setvalue','Set a numeric UI/object value and return readback.',{...common,name:str,objectId:str,value:num},['session','value']],
  ['max_send','Send bang/int/float/list/set to an object by ID or varname; can trigger connected behavior.',{...common,name:str,objectId:str,selector:{type:'string',enum:['bang','int','float','list','set']},args:atoms},['session','selector','args']],
  ['max_remove','Remove an object created by this receiver session, including its cords.',{...common,name:str,objectId:str},['session']],
  ['max_console','Read current global Max Console history without opening its window. Does not clear messages.',{session:str,limit:{type:'integer',minimum:1},contains:str},['session'],true],
  ['max_preferences','Read Max application attributes exposed by its native API. No Preferences window or changes.',{session:str,names:{type:'array',items:str,maxItems:512}},['session'],true],
  ['max_audio_status','Read audio/DSP settings and available choices through adstatus without opening Audio Status.',{session:str,settings:{type:'array',items:str,maxItems:16}},['session'],true],
  ['max_audio_set','Change an explicitly requested application-wide audio setting; requires current setting value and patch revision. May affect playback in all projects.',{...common,setting:{type:'string',enum:['switch','sr','sigvs','iovs','overdrive','takeover','cpulimit']},value:num,expectedValue:num},['session','setting','value','expectedValue']],
  ['max_bridge_restart','Restart only this host bridge, without UI actions or closing the patch. Reconnect and inspect afterward.',{...common},['session']],
  ['max_reference','Read installed Max XML reference with source path and checksum.',{name:str,domain:str},['name'],true]
];
for(const definition of definitions) {
  if(!definition[4]) {definition[2].expectedRevision=str;definition[3].push('expectedRevision');}
}
export const tools=definitions.map(([name,description,properties,required,readOnlyHint=false])=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint,destructiveHint:!readOnlyHint,openWorldHint:false}}));
function validateArgs(schema,a) {
  if(!a || typeof a!=='object'||Array.isArray(a)) throw Error('Arguments must be an object');
  for(const k of schema.required) if(!(k in a)) throw Error(`Missing argument: ${k}`);
  for(const [k,v] of Object.entries(a)) {
    const s=schema.properties[k];if(!s)throw Error(`Unknown argument: ${k}`);
    if(s.type==='array') {
      if(!Array.isArray(v)||v.length>(s.maxItems||1000)||v.some(x=>!([].concat(s.items.type).includes(typeof x))))throw Error(`Invalid array: ${k}`);
    } else if(s.type==='integer'?!Number.isInteger(v):typeof v!==s.type) throw Error(`Invalid type: ${k}`);
    if(typeof v==='number'&&(!Number.isFinite(v)||(s.minimum!==undefined&&v<s.minimum)))throw Error(`Invalid number: ${k}`);
    if(s.enum&&!s.enum.includes(v))throw Error(`Invalid value: ${k}`);
  }
}
export async function callTool(name,args={}) {
  const tool=tools.find(t=>t.name===name);if(!tool)throw Error(`Unknown tool: ${name}`);
  validateArgs(tool.inputSchema,args);
  if(['max_move','max_setvalue','max_send','max_remove'].includes(name)) {
    if(('name' in args)===('objectId' in args))throw Error('Supply exactly one of name or objectId');
  }
  if(['max_connect','max_disconnect'].includes(name)) {
    for(const [n,id] of [['source','sourceId'],['destination','destinationId']])if((n in args)===(id in args))throw Error(`Supply exactly one of ${n} or ${id}`);
  }
  if(name==='max_console' && (args.limit||100)>500)throw Error('Console limit cannot exceed 500 lines');
  if(name==='max_reference') {
    if(!process.env.MAX_ROOT)throw Error('Set MAX_ROOT to the installed Max folder');
    const argv=['-NoProfile','-File',path.join(here,'..','scripts','reference.ps1'),'-MaxRoot',process.env.MAX_ROOT,'-Name',args.name];
    if(args.domain)argv.push('-Domain',args.domain);
    const {stdout}=await exec(process.env.MAX_POWERSHELL||'powershell.exe',argv,{windowsHide:true,timeout:20000,maxBuffer:1048576});
    return JSON.parse(stdout.replace(/^\uFEFF/,''));
  }
  let state;
  const statePath=process.env.MAX_BRIDGE_STATE || path.join(process.platform==='win32'?path.join(os.homedir(),'AppData','Local','Temp'):os.tmpdir(),`codex-max-bridge-${port}.json`);
  try {state=JSON.parse(fs.readFileSync(statePath,'utf8'));}
  catch {throw Error('Max bridge is offline. Open max-control.maxpat in Max and start its node.script.');}
  if(state.port!==port)throw Error('Bridge state port mismatch');
  const status=name==='max_status';
  if(!status && state.version!=='0.3.0')throw Error('Bridge version mismatch: stop the Max bridge, update all bridge files and restart it before editing.');
  const requestId=crypto.randomUUID();
  let response;
  try {response=await fetch(`http://127.0.0.1:${port}/${status?'status':'call'}`,{
    method:status?'GET':'POST',headers:{Authorization:`Bearer ${state.token}`,'Content-Type':'application/json'},
    ...(status?{}:{body:JSON.stringify({id:requestId,session:args.session,method:name.replace('max_',''),args})}),signal:AbortSignal.timeout(10000)
  });} catch(e) {throw Error(`Request ${requestId}: transport failed; outcome unknown. Read max_status and max_inspect before any retry. ${e.message}`);}
  const result=await response.json();
  if(!response.ok||result.ok===false)throw Error(`Request ${requestId}: ${result.error||`Bridge HTTP ${response.status}`}`);
  return result;
}
export async function rpc(message) {
  const id=message?.id;
  if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')return {jsonrpc:'2.0',id:id??null,error:{code:-32600,message:'Invalid request'}};
  if(id===undefined)return null;
  try {
    let result;
    if(message.method==='initialize') {
      const supported=['2024-11-05','2025-03-26','2025-06-18','2025-11-25'];
      const requested=message.params?.protocolVersion;
      result={protocolVersion:supported.includes(requested)?requested:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'max-windows',version:'0.3.0'}};
    } else if(message.method==='ping')result={};
    else if(message.method==='tools/list')result={tools};
    else if(message.method==='tools/call') {
      try {result={content:[{type:'text',text:JSON.stringify(await callTool(message.params?.name,message.params?.arguments||{}))}]};}
      catch(e){result={isError:true,content:[{type:'text',text:e.message}]};}
    } else return {jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}};
    return {jsonrpc:'2.0',id,result};
  } catch(e){return {jsonrpc:'2.0',id,error:{code:-32603,message:e.message}};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  let queue=Promise.resolve();
  const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  input.on('line',line=>{queue=queue.then(async()=>{
    let message;try {message=JSON.parse(line);}catch {process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n');return;}
    const result=Array.isArray(message)?(await Promise.all(message.map(rpc))).filter(Boolean):await rpc(message);
    if(result && (!Array.isArray(result)||result.length))process.stdout.write(JSON.stringify(result)+'\n');
  }).catch(e=>process.stderr.write(e.message+'\n'));});
}
