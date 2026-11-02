import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
const require=createRequire(import.meta.url);

function fixture() {
  let handler,reply,state,now=1000;
  const timers=[],sent=[];
  const max={post(){},addHandler(_name,fn){reply=fn;},outlet(_name,text){sent.push(JSON.parse(text));}};
  const server={on(){},listen(_p,_h,fn){fn();}};
  const fakeFs={writeFileSync(_path,text){state=JSON.parse(text);}};
  const context=vm.createContext({
    require(name){if(name==='max-api')return max;if(name==='node:http')return {createServer(fn){handler=fn;return server;}};if(name==='node:fs')return fakeFs;return require(name);},
    process:{env:{},platform:'win32',on(){}},Buffer,
    Date:{now:()=>now},
    setTimeout(fn){const timer={fn};timers.push(timer);return timer;},clearTimeout(timer){timer.cancelled=true;}
  });
  vm.runInContext(fs.readFileSync(new URL('./max-node.js',import.meta.url),'utf8'),context);
  function call(id,method='move',args={},headers={}) {
    const req=new EventEmitter();Object.assign(req,{method:'POST',url:'/call',headers:{host:'127.0.0.1:8711',authorization:'Bearer '+state.token,...headers},destroy(){}});
    const res={writableEnded:false,writeHead(status){this.status=status;},end(text){this.body=JSON.parse(text);this.writableEnded=true;}};
    handler(req,res);req.emit('data',JSON.stringify({id,method,args,session:state.session}));req.emit('end');return res;
  }
  return {call,sent,reply(value){reply(JSON.stringify(value));},timeout(){now+=9000;for(const timer of timers.splice(0))if(!timer.cancelled)timer.fn();}};
}

test('timed-out mutation stays blocked until successful in-Max inspection; never replays unknown outcome',()=>{
  const f=fixture();const original=f.call('a');f.timeout();
  assert.equal(original.status,504);
  assert.equal(f.call('b').status,409);
  const inspection=f.call('read','inspect');assert.equal(f.sent.length,2);
  f.reply({id:'read',ok:true,result:{objects:[],revision:'new'}});
  assert.equal(inspection.status,200);assert.deepEqual(inspection.body.reconciled,['a']);
  const replay=f.call('a');assert.equal(replay.body.ok,false);assert.equal(replay.body.reconciled,true);
  assert.equal(f.sent.length,2);
  f.call('new');assert.equal(f.sent.length,3);
});

test('failed recovery read does not unblock writes; late reply remains observable',()=>{
  const f=fixture();f.call('a');f.timeout();
  f.call('read','inspect');f.reply({id:'read',ok:false,error:'read failed'});
  assert.equal(f.call('b').status,409);
  f.reply({id:'a',ok:true,result:{changed:true}});
  assert.equal(f.call('a').body.result.changed,true);
  f.call('b');assert.equal(f.sent.length,3);
});

test('in-flight writes cannot be bypassed by reads; cached IDs cannot change arguments',()=>{
  const f=fixture();f.call('a');assert.equal(f.call('read','inspect').status,409);
  f.reply({id:'a',ok:true,result:{}});
  assert.equal(f.call('a','move',{name:'different'}).status,409);
  assert.equal(f.sent.length,1);
});

test('browser Origin and incorrect credentials rejected before Max execution',()=>{
  const f=fixture();
  assert.equal(f.call('a','inspect',{}, {origin:'https://example.com'}).status,403);
  assert.equal(f.call('b','inspect',{}, {authorization:'Bearer wrong'}).status,403);
  assert.equal(f.sent.length,0);
});
