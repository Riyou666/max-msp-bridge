// Runs ONLY in Max's node.script (use .js for Max file resolution).
const max = require('max-api');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const port = Number(process.env.MAX_BRIDGE_PORT || 8711);
const token = crypto.randomBytes(32).toString('hex');
const session = crypto.randomUUID();
const statePath = process.env.MAX_BRIDGE_STATE || path.join(process.platform==='win32'?path.join(os.homedir(),'AppData','Local','Temp'):os.tmpdir(), `codex-max-bridge-${port}.json`);
const pending = new Map();
const completed = new Map();
const methods = new Set(['inspect','create','connect','disconnect','move','setvalue','send','remove']);
const respond = (res, status, data) => { if (!res.writableEnded) { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(data)); } };

max.addHandler('response', text => {
  try {
    const reply = JSON.parse(text);
    const p = pending.get(reply.id);
    if (!p) return;
    clearTimeout(p.timer); pending.delete(reply.id);
    const result = {...reply, session};
    // A successful in-Max read after all older deadlines is a recovery barrier.
    // Old outcomes stay unknown; this is not a rollback or automatic retry.
    if(p.method==='inspect' && reply.ok) {
      result.reconciled=[];
      for(const [id,old] of pending) if(old.timedOut && Date.now()>old.deadline) {
        clearTimeout(old.timer); pending.delete(id); result.reconciled.push(id);
        completed.set(id,{body:old.body,result:{id,session,ok:false,reconciled:true,error:'Outcome unknown; reconciled by subsequent Max inspection. Do not replay.'}});
      }
    }
    completed.set(reply.id, {body:p.body, result});
    while (completed.size > 256) completed.delete(completed.keys().next().value);
    respond(p.res, 200, result);
  } catch (e) { max.post(`Max bridge response error: ${e.message}`); }
});

const server = http.createServer((req,res) => {
  if (req.headers.origin || req.headers.host !== `127.0.0.1:${port}` || req.headers.authorization !== `Bearer ${token}`) return respond(res,403,{error:'Forbidden'});
  if (req.method === 'GET' && req.url === '/status') return respond(res,200,{session,port,bridge:'max-windows',version:'0.2.0',pending:Array.from(pending,([id,p])=>({id,method:p.method,timedOut:p.timedOut})),recent:Array.from(completed,([id,p])=>({id,ok:p.result.ok,error:p.result.error,reconciled:p.result.reconciled})).slice(-32)});
  if (req.method !== 'POST' || req.url !== '/call') return respond(res,404,{error:'Not found'});
  let body = ''; let oversized = false;
  req.on('data',chunk => { body += chunk; if (Buffer.byteLength(body) > 65536) { oversized = true; respond(res,413,{error:'Request too large'}); req.destroy(); } });
  req.on('end',() => {
    if (oversized) return;
    try {
      const call = JSON.parse(body);
      if (typeof call.id !== 'string' || !call.id || !methods.has(call.method) || !call.args || typeof call.args !== 'object' || Array.isArray(call.args)) throw Error('Invalid call');
      if (call.session !== session) return respond(res,409,{error:'Stale session. Read max_status and inspect before modifying.'});
      if (completed.has(call.id)) {
        const previous = completed.get(call.id);
        if (previous.body !== body) return respond(res,409,{error:'Request ID reused with different arguments'});
        return respond(res,200,previous.result);
      }
      if (pending.size && !(call.method==='inspect' && Array.from(pending.values()).every(p=>p.timedOut && Date.now()>p.deadline))) return respond(res,409,{error:'An operation is pending. Inspect before retrying; requests are serialized.'});
      const deadline=Date.now()+7000;
      const timer = setTimeout(() => {
        // Retain unknown outcome until a successful readback crosses the deadline.
        const operation=pending.get(call.id); if(operation)operation.timedOut=true;
        respond(res,504,{error:'Max reply timed out; outcome unknown. Do not blindly retry.',session});
      },8000);
      pending.set(call.id,{res,timer,body,method:call.method,deadline,timedOut:false});
      max.outlet('request', JSON.stringify({...call,deadline}));
    } catch (e) { respond(res,400,{error:e.message}); }
  });
});
server.on('error',e => max.post(`Max bridge failed: ${e.message}`));
server.listen(port,'127.0.0.1',() => {
  fs.writeFileSync(statePath,JSON.stringify({port,token,session,version:'0.2.0'}),{mode:0o600});
  max.post(`Max Windows bridge ready on 127.0.0.1:${port}; session ${session}`);
});
function cleanup() {
  try { const state=JSON.parse(fs.readFileSync(statePath,'utf8')); if(state.session===session) fs.unlinkSync(statePath); } catch {}
}
process.on('exit',cleanup);
process.on('SIGTERM',() => { cleanup(); process.exit(0); });
