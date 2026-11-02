// Max v8 script. Structured calls only; never eval received text.
autowatch = 1;
inlets = 1;
outlets = 1;
var managed = {};
var identities = [];
var nextIdentity = 0;
var snapshots = {};
var nextSnapshot = 0;
var epoch = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
function identity(o) {
    identities = identities.filter(function(e){return e.object.valid;});
    for(var i=0;i<identities.length;i++) if(identities[i].object === o) return identities[i].id;
    var id = epoch + ':o' + (++nextIdentity);
    identities.push({object:o,id:id}); return id;
}
function fingerprint(state) {
    return JSON.stringify({name:state.name,filepath:state.filepath,locked:state.locked,
        objects:state.objects.map(function(o){var c=Object.assign({},o);delete c.selected;return c;}).sort(function(a,b){return a.id.localeCompare(b.id);}),
        connections:state.connections.slice().sort(function(a,b){return JSON.stringify(a).localeCompare(JSON.stringify(b));})});
}
function checkpoint(p,scope) {
    var state=inspect(p), token=epoch+':r'+(++nextSnapshot);
    snapshots[token]={scope:JSON.stringify(scope),fingerprint:fingerprint(state)};
    var keys=Object.keys(snapshots);if(keys.length>64)delete snapshots[keys[0]];
    state.revision=token;return state;
}

function fail(message) { throw new Error(message); }
function safe(fn) { try { return fn(); } catch (_) { return null; } }
function nameOK(name) { return typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(name); }
function named(p, name) {
    if (!nameOK(name)) fail('Use a simple non-reserved varname');
    var o = p.getnamed(name);
    if (!o || !o.valid) fail('Object not found: ' + name);
    return o;
}
function scopeOf(root, scope) {
    if (!Array.isArray(scope) || scope.length > 12) fail('scope must be a varname array, maximum depth 12');
    var p = root;
    for (var i=0;i<scope.length;i++) {
        p = named(p,scope[i]).subpatcher();
        if (!p) fail('Scope is not a subpatcher');
    }
    return p;
}
function describe(o) {
    return {id:identity(o),varname:o.varname || null, maxclass:o.maxclass, text:safe(function(){return o.boxtext;}),
        rect:safe(function(){return o.rect;}), value:safe(function(){return o.getvalueof();}),
        selected:safe(function(){return o.selected;}),
        numinlets:safe(function(){return o.getboxattr('numinlets');}),
        numoutlets:safe(function(){return o.getboxattr('numoutlets');})};
}
function cords(p) {
    var result=[];
    for(var o=p.firstobject;o;o=o.nextobject) {
        var c=o.patchcords;
        if (!c || !c.outputs) continue;
        for(var i=0;i<c.outputs.length;i++) {
            var x=c.outputs[i];
            result.push({sourceId:identity(x.srcobject),destinationId:identity(x.dstobject),source:x.srcobject.varname || null,outlet:x.srcoutlet,
                destination:x.dstobject.varname || null,inlet:x.dstinlet});
        }
    }
    return result;
}
function inspect(p) {
    var objects=[];
    for(var o=p.firstobject;o;o=o.nextobject) objects.push(describe(o));
    return {name:p.name,filepath:p.filepath,locked:p.locked,objects:objects,connections:cords(p),
        coverage:'Current scope only. Unnamed objects are readable but need a varname for mutations. Console/audio not captured.'};
}
function matchCord(c,a) {return c.source===a.source && c.outlet===a.outlet && c.destination===a.destination && c.inlet===a.inlet;}
function execute(root, method, a) {
    var p=scopeOf(root,a.scope || []), o, key=JSON.stringify(a.scope||[])+'/'+a.name;
    if(method==='inspect') return checkpoint(p,a.scope||[]);
    var snapshot=snapshots[a.expectedRevision];
    if(!snapshot || snapshot.scope!==JSON.stringify(a.scope||[]) || snapshot.fingerprint!==fingerprint(inspect(p)))
        fail('State conflict: inspect this scope and reconsider the change before retrying');
    delete snapshots[a.expectedRevision]; // A mutation attempt consumes its precondition, including failures.
    if(method==='create') {
        if(!nameOK(a.name)) fail('Invalid varname');
        if(p.getnamed(a.name)) fail('Name already exists; inspect before retrying');
        if(typeof a.object!=='string' || !a.object || /\s/.test(a.object)) fail('object must be a class name; supply separate args');
        if(!Number.isFinite(a.x)||!Number.isFinite(a.y)) fail('Invalid coordinates');
        if(!Array.isArray(a.args)||a.args.length>64||a.args.some(function(x){return !(typeof x==='string'||typeof x==='number');})) fail('args must contain atoms');
        o=p.newdefault.apply(p,[a.x,a.y,a.object].concat(a.args));
        if(!o || !o.valid || o.maxclass==='bogus') {if(o&&o.valid)p.remove(o);fail('Max could not instantiate object');}
        o.varname=a.name; managed[key]=o;
        return describe(o);
    }
    if(method==='connect'||method==='disconnect') {
        if(!Number.isInteger(a.outlet)||!Number.isInteger(a.inlet)||a.outlet<0||a.inlet<0) fail('Port indices must be nonnegative integers');
        var src=named(p,a.source),dst=named(p,a.destination);
        var exists=cords(p).some(function(c){return matchCord(c,a);});
        if(method==='connect'&&!exists) p.connect(src,a.outlet,dst,a.inlet);
        if(method==='disconnect'&&exists) p.disconnect(src,a.outlet,dst,a.inlet);
        var after=cords(p).some(function(c){return matchCord(c,a);});
        if(after!==(method==='connect')) fail('Connection readback failed; check port roles/counts and Max Console');
        return {connected:after,source:a.source,destination:a.destination,outlet:a.outlet,inlet:a.inlet};
    }
    o=named(p,a.name);
    if(method==='move') {
        if(!Number.isFinite(a.x)||!Number.isFinite(a.y)) fail('Invalid coordinates');
        var r=o.rect;o.rect=[a.x,a.y,a.x+r[2]-r[0],a.y+r[3]-r[1]];return describe(o);
    }
    if(method==='setvalue') {
        if(!Number.isFinite(a.value)) fail('Expected finite numeric value');
        o.setvalueof(a.value);return describe(o);
    }
    if(method==='send') {
        if(['bang','int','float','list','set'].indexOf(a.selector)<0) fail('Unsupported selector');
        if(!Array.isArray(a.args)||a.args.length>64||a.args.some(function(x){return !(typeof x==='string'||typeof x==='number');})) fail('args must contain atoms');
        o.message.apply(o,[a.selector].concat(a.args));return describe(o);
    }
    if(method==='remove') {
        if(!managed[key] || !managed[key].valid || managed[key] !== o) fail('This minimal bridge only removes objects it created in this receiver session');
        p.remove(o);delete managed[key];return {removed:a.name};
    }
    fail('Unknown operation');
}
function request(text) {
    var req;
    try {
        req=JSON.parse(text);
        if(!Number.isFinite(req.deadline) || Date.now()>req.deadline) fail('Expired request was not executed');
        var value=execute(this.patcher,req.method,req.args);
        outlet(0,'response',JSON.stringify({id:req.id,ok:true,result:value}));
    } catch(e) {
        outlet(0,'response',JSON.stringify({id:req?req.id:null,ok:false,error:String(e.message||e)}));
    }
}
