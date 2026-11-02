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
    completed.set(reply.id, {body:p.body, result});
    if (completed.size > 256) completed.delete(completed.keys().next().value);
    respond(p.res, 200, result);
  } catch (e) { max.post(`Max bridge response error: ${e.message}`); }
});

const server = http.createServer((req,res) => {
  if (req.headers.origin || req.headers.host !== `127.0.0.1:${port}` || req.headers.authorization !== `Bearer ${token}`) return respond(res,403,{error:'Forbidden'});
  if (req.method === 'GET' && req.url === '/status') return respond(res,200,{session,port,bridge:'max-windows',version:'0.1.0',pending:pending.size});
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
      if (pending.size) return respond(res,409,{error:'An operation is pending. Inspect before retrying; requests are serialized.'});
      const timer = setTimeout(() => {
        // Keep the in-flight entry: a queued Max event may still execute later.
        respond(res,504,{error:'Max reply timed out; outcome unknown. Do not blindly retry.',session});
      },8000);
      pending.set(call.id,{res,timer,body});
      max.outlet('request', JSON.stringify({...call,deadline:Date.now()+7000}));
    } catch (e) { respond(res,400,{error:e.message}); }
  });
});
server.on('error',e => max.post(`Max bridge failed: ${e.message}`));
server.listen(port,'127.0.0.1',() => {
  fs.writeFileSync(statePath,JSON.stringify({port,token,session}),{mode:0o600});
  max.post(`Max Windows bridge ready on 127.0.0.1:${port}; session ${session}`);
});
function cleanup() {
  try { const state=JSON.parse(fs.readFileSync(statePath,'utf8')); if(state.session===session) fs.unlinkSync(statePath); } catch {}
}
process.on('exit',cleanup);
process.on('SIGTERM',() => { cleanup(); process.exit(0); });
