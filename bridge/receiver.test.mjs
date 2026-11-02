import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture() {
  const objects=[], connections=[];
  const p={name:'test',filepath:'',locked:false,
    get firstobject(){return objects[0];},
    getnamed(name){return objects.find(o=>o.varname===name);},
    newdefault(x,y,maxclass){
      const o={valid:true,varname:'',maxclass,rect:[x,y,x+20,y+20],value:0,
        getvalueof(){return this.value;},setvalueof(v){this.value=v;},
        annotation:'',getboxattr(name){return name==='annotation'?this.annotation:1;},setboxattr(name,value){this[name]=value;},
        get nextobject(){return objects[objects.indexOf(this)+1];},
        get patchcords(){return {outputs:connections.filter(c=>c.srcobject===this)};}};
      objects.push(o);return o;
    },
    remove(o){o.valid=false;objects.splice(objects.indexOf(o),1);},
    connect(srcobject,srcoutlet,dstobject,dstinlet){connections.push({srcobject,srcoutlet,dstobject,dstinlet});}
  };
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('./max-receiver.js',import.meta.url),'utf8'),context);
  const inspect=()=>context.execute(p,'inspect',{});
  const mutate=(method,args)=>context.execute(p,method,{expectedRevision:inspect().revision,...args});
  return {p,context,inspect,mutate};
}

test('same-name manual replacement never inherits removal ownership',()=>{
  const {p,mutate}=fixture();
  mutate('create',{name:'demo',object:'number',args:[],x:0,y:0});
  p.remove(p.getnamed('demo'));
  const replacement=p.newdefault(0,0,'number');replacement.varname='demo';
  assert.throws(()=>mutate('remove',{name:'demo'}),/only removes/);
  assert.equal(replacement.valid,true);
});

test('original created object can be removed; existing object cannot',()=>{
  const {p,mutate}=fixture();
  const existing=p.newdefault(0,0,'number');existing.varname='old';
  assert.throws(()=>mutate('remove',{name:'old'}),/only removes/);
  mutate('create',{name:'demo',object:'number',args:[],x:0,y:0});
  mutate('remove',{name:'demo'});
  assert.equal(p.getnamed('demo'),undefined);
});

test('unnamed objects and cord endpoints have distinct stable identities without renaming',()=>{
  const {p,inspect}=fixture();
  const a=p.newdefault(0,0,'number'),b=p.newdefault(0,0,'number');
  p.connect(a,0,b,0);
  const first=inspect(),second=inspect();
  assert.notEqual(first.objects[0].id,first.objects[1].id);
  assert.equal(first.objects[0].id,second.objects[0].id);
  assert.equal(first.connections[0].sourceId,first.objects[0].id);
  assert.equal(first.connections[0].destinationId,first.objects[1].id);
  assert.equal(a.varname,'');assert.equal(b.varname,'');
});

test('manual movement, value edit, replacement, or wiring rejects a stale revision',()=>{
  for(const change of ['move','value','replace','wire']) {
    const {p,inspect,context}=fixture();
    const a=p.newdefault(0,0,'number');a.varname='a';
    const b=p.newdefault(0,0,'number');b.varname='b';
    const revision=inspect().revision;
    if(change==='move')a.rect=[1,1,21,21];
    if(change==='value')a.value=12;
    if(change==='replace'){p.remove(a);p.newdefault(0,0,'number').varname='a';}
    if(change==='wire')p.connect(a,0,b,0);
    assert.throws(()=>context.execute(p,'setvalue',{name:'b',value:99,expectedRevision:revision}),/State conflict/);
    assert.equal(b.value,0);
  }
});

test('revision is required and single-use, including failed mutations',()=>{
  const {p,context,inspect}=fixture();
  const a=p.newdefault(0,0,'number');a.varname='a';
  assert.throws(()=>context.execute(p,'move',{name:'a',x:1,y:1}),/State conflict/);
  const revision=inspect().revision;
  assert.throws(()=>context.execute(p,'move',{name:'absent',x:1,y:1,expectedRevision:revision}),/not found/);
  assert.throws(()=>context.execute(p,'move',{name:'a',x:1,y:1,expectedRevision:revision}),/State conflict/);
});

test('unnamed objects can be wired and edited by ID without renaming',()=>{
  const {p,inspect,mutate}=fixture();
  const a=p.newdefault(0,0,'number'),b=p.newdefault(0,0,'number');
  const state=inspect(),sourceId=state.objects[0].id,destinationId=state.objects[1].id;
  const result=mutate('connect',{sourceId,destinationId,outlet:0,inlet:0});
  assert.equal(result.connected,true);
  mutate('setvalue',{objectId:sourceId,value:21});
  mutate('move',{objectId:destinationId,x:40,y:60});
  assert.equal(a.value,21);assert.equal(b.rect[0],40);
  assert.equal(a.varname,'');assert.equal(b.varname,'');
});

test('IDs cannot target another scope, stale objects or protected bridge internals',()=>{
  const {p,inspect,mutate}=fixture();
  const protectedObject=p.newdefault(0,0,'number');protectedObject.varname='__maxbridge_node';
  const id=inspect().objects[0].id;
  assert.throws(()=>mutate('move',{objectId:id,x:1,y:1}),/protected/);
  assert.throws(()=>mutate('move',{objectId:'unknown:o1',x:1,y:1}),/not found/);
  const original=p.newdefault(0,0,'number'),oldId=inspect().objects.find(o=>!o.varname).id;
  p.remove(original);p.newdefault(0,0,'number');
  assert.throws(()=>mutate('move',{objectId:oldId,x:1,y:1}),/not found/);
  assert.throws(()=>mutate('move',{objectId:id,name:'also',x:1,y:1}),/exactly one/);
});

test('existing punctuation-bearing names remain unchanged and duplicate names fail closed',()=>{
  const {p,mutate}=fixture();
  const a=p.newdefault(0,0,'number');a.varname='live.gain~[2]';
  mutate('setvalue',{name:a.varname,value:3});assert.equal(a.value,3);
  p.newdefault(0,0,'number').varname=a.varname;
  assert.throws(()=>mutate('setvalue',{name:a.varname,value:4}),/ambiguous/);
});

test('removal by ID keeps instance ownership checks',()=>{
  const {p,inspect,mutate}=fixture();
  const existing=p.newdefault(0,0,'number'),id=inspect().objects[0].id;
  assert.throws(()=>mutate('remove',{objectId:id}),/only removes/);
  const created=mutate('create',{name:'owned',object:'number',args:[],x:0,y:0});
  mutate('remove',{objectId:created.id});assert.equal(existing.valid,true);
});

test('audio changes require an exact current value and valid bounded input',()=>{
  const {context}=fixture();let writes=0,current=0;
  context.audioProbe=(_key,value)=>{if(value!==undefined){writes++;current=value;}return {value:current};};
  assert.throws(()=>context.audioSet({setting:'switch',value:1,expectedValue:1}),/changed/);
  assert.throws(()=>context.audioSet({setting:'switch',value:2,expectedValue:0}),/0 or 1/);
  assert.throws(()=>context.audioSet({setting:'cpulimit',value:101,expectedValue:0}),/0..100/);
  assert.throws(()=>context.audioSet({setting:'driver',value:1,expectedValue:0}),/Unsupported/);
  assert.equal(writes,0);
  assert.equal(context.audioSet({setting:'switch',value:0,expectedValue:0}).changed,false);
  assert.equal(writes,0);
  assert.equal(context.audioSet({setting:'switch',value:1,expectedValue:0}).after.value,1);
  assert.equal(writes,1);
});

test('native wrapper reuse without the creation marker cannot inherit an ID or deletion rights',()=>{
  const {p,inspect,mutate}=fixture();
  const created=mutate('create',{name:'reused',object:'number',args:[],x:0,y:0});
  // Simulate the native allocator reusing a wrapper for a same-name replacement.
  p.getnamed('reused').annotation='';
  const replacement=inspect().objects[0];
  assert.notEqual(replacement.id,created.id);
  assert.throws(()=>mutate('remove',{objectId:replacement.id}),/only removes/);
  assert.equal(p.getnamed('reused').valid,true);
});

test('unnamed subpatcher IDs resolve scopes, but object IDs cannot escape their scope',()=>{
  const parent=fixture(),child=fixture();
  const sub=parent.p.newdefault(0,0,'patcher');sub.subpatcher=()=>child.p;
  const item=child.p.newdefault(0,0,'number');
  const subId=parent.inspect().objects[0].id;
  const state=parent.context.execute(parent.p,'inspect',{scope:[subId]});
  const childId=state.objects[0].id;
  assert.throws(()=>parent.mutate('move',{objectId:childId,x:5,y:5}),/not found/);
  parent.context.execute(parent.p,'move',{scope:[subId],objectId:childId,x:5,y:5,expectedRevision:state.revision});
  assert.equal(item.rect[0],5);assert.equal(item.varname,'');
});
