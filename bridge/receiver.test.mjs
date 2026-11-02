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
        getboxattr(){return 1;},
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
