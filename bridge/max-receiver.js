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
    // Do not dereference stale Max handles: native allocator reuse can retain JS wrappers.
    var signature=String(o.maxclass)+'\0'+String(o.varname||'')+'\0'+String(safe(function(){return o.getboxattr('annotation');})||'');
    for(var i=0;i<identities.length;i++) if(identities[i].object === o && identities[i].signature===signature)return identities[i].id;
    var id = epoch + ':o' + (++nextIdentity);
    identities.push({object:o,id:id,signature:signature}); return id;
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
function named(p, ref) {
    if(typeof ref!=='string'||!ref||ref.length>256)fail('Object ID or existing varname required');
    var matches=[];
    for(var o=p.firstobject;o;o=o.nextobject) if(identity(o)===ref || o.varname===ref)matches.push(o);
    if(matches.length!==1)fail('Object not found or ambiguous: '+ref);
    if((matches[0].varname||'').indexOf('__maxbridge_')===0)fail('Bridge internals are protected');
    return matches[0];
}
function target(p,a,nameKey,idKey) {
    if((typeof a[nameKey]==='string')===(typeof a[idKey]==='string'))fail('Supply exactly one of '+nameKey+' or '+idKey);
    return named(p,a[idKey] || a[nameKey]);
}
function scopeOf(root, scope) {
    if (!Array.isArray(scope) || scope.length > 12) fail('scope must be an object-ID or varname array, maximum depth 12');
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
    return {receiverVersion:'0.3.0',name:p.name,filepath:p.filepath,locked:p.locked,objects:objects,connections:cords(p),
        coverage:'Current scope only. Use runtime object IDs or unique existing varnames for mutations; IDs expire on receiver reload.'};
}
function matchCord(c,a) {return c.sourceId===a.sourceId && c.outlet===a.outlet && c.destinationId===a.destinationId && c.inlet===a.inlet;}
function execute(root, method, a) {
    var p=scopeOf(root,a.scope || []), o, key=JSON.stringify(a.scope||[])+'/'+a.name;
    if(method==='inspect') return checkpoint(p,a.scope||[]);
    if(method==='console')return exportConsole(a);
    if(method==='preferences')return preferences(a);
    if(method==='audio_status')return {settings:(a.settings||audioKeys).map(function(key){return audioProbe(key);}),scope:'Application-wide'};
    var snapshot=snapshots[a.expectedRevision];
    if(!snapshot || snapshot.scope!==JSON.stringify(a.scope||[]) || snapshot.fingerprint!==fingerprint(inspect(p)))
        fail('State conflict: inspect this scope and reconsider the change before retrying');
    delete snapshots[a.expectedRevision]; // A mutation attempt consumes its precondition, including failures.
    // The send alias permits a controlled hot restart of the 0.2 transport after receiver upgrade.
    if(method==='bridge_restart' || (method==='send' && a.bridgeRestart===true)) {
        if((a.scope||[]).length)fail('Bridge restart requires root scope');
        return restartBridge(root);
    }
    if(method==='audio_set')return audioSet(a);
    if(method==='create') {
        if(!nameOK(a.name)) fail('Invalid varname');
        if(p.getnamed(a.name)) fail('Name already exists; inspect before retrying');
        if(typeof a.object!=='string' || !a.object || /\s/.test(a.object)) fail('object must be a class name; supply separate args');
        if(!Number.isFinite(a.x)||!Number.isFinite(a.y)) fail('Invalid coordinates');
        if(!Array.isArray(a.args)||a.args.length>64||a.args.some(function(x){return !(typeof x==='string'||typeof x==='number');})) fail('args must contain atoms');
        o=p.newdefault.apply(p,[a.x,a.y,a.object].concat(a.args));
        if(!o || !o.valid || o.maxclass==='bogus') {if(o&&o.valid)p.remove(o);fail('Max could not instantiate object');}
        o.varname=a.name;
        var marker='[codex-owner:'+epoch+':'+(++nextIdentity)+']';
        var annotation=String(safe(function(){return o.getboxattr('annotation');})||'');
        o.setboxattr('annotation',annotation+(annotation?'\n':'')+marker);
        managed[identity(o)]={object:o,marker:marker};
        return describe(o);
    }
    if(method==='connect'||method==='disconnect') {
        if(!Number.isInteger(a.outlet)||!Number.isInteger(a.inlet)||a.outlet<0||a.inlet<0) fail('Port indices must be nonnegative integers');
        var src=target(p,a,'source','sourceId'),dst=target(p,a,'destination','destinationId');
        a=Object.assign({},a,{sourceId:identity(src),destinationId:identity(dst)});
        var exists=cords(p).some(function(c){return matchCord(c,a);});
        if(method==='connect'&&!exists) p.connect(src,a.outlet,dst,a.inlet);
        if(method==='disconnect'&&exists) p.disconnect(src,a.outlet,dst,a.inlet);
        var after=cords(p).some(function(c){return matchCord(c,a);});
        if(after!==(method==='connect')) fail('Connection readback failed; check port roles/counts and Max Console');
        return {connected:after,sourceId:a.sourceId,destinationId:a.destinationId,source:src.varname||null,destination:dst.varname||null,outlet:a.outlet,inlet:a.inlet};
    }
    o=target(p,a,'name','objectId');key=identity(o);
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
        if(!managed[key] || managed[key].object !== o || String(safe(function(){return o.getboxattr('annotation');})||'').indexOf(managed[key].marker)<0) fail('This minimal bridge only removes objects it created in this receiver session');
        var removedName=o.varname||null;p.remove(o);delete managed[key];return {removed:key,varname:removedName};
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

// Native diagnostics; no window automation.
var diagnosticsPatch = null;
var restartTasks = [];
function diagnosticHost() {
    if (!diagnosticsPatch) {
        diagnosticsPatch = new Patcher();
        // A separate, hidden runtime patch keeps helper objects out of the user's graph.
        if (diagnosticsPatch.wind) diagnosticsPatch.wind.visible = 0;
    }
    return diagnosticsPatch;
}
function withHelpers(fn) {
    var p=diagnosticHost(), created=[];
    function make() {
        var o=p.newdefault.apply(p,[20,20].concat(Array.prototype.slice.call(arguments)));
        if(!o || !o.valid || o.maxclass==='bogus') {if(o && o.valid)p.remove(o);fail('Diagnostic object unavailable');}
        created.push(o);return o;
    }
    try {return fn(p,make);} finally {
        for(var i=created.length-1;i>=0;i--)if(created[i].valid)p.remove(created[i]);
    }
}
var audioKeys=['switch','sr','sigvs','iovs','overdrive','takeover','cpulimit','cpu','numinputs','numoutputs','driver'];
var audioWritable=['switch','sr','sigvs','iovs','overdrive','takeover','cpulimit'];
function audioProbe(setting,writeValue) {
    if(audioKeys.indexOf(setting)<0)fail('Unsupported audio setting');
    return withHelpers(function(p,make){
        var ad=make('adstatus',setting),sink=make('flonum'),menu=make('umenu');
        sink.message('set',-123456789);
        if(setting!=='driver')p.connect(ad,['cpu','cpulimit'].indexOf(setting)>=0?0:1,sink,0);
        if(['cpu','cpulimit','numinputs','numoutputs'].indexOf(setting)<0)p.connect(ad,0,menu,0);
        ad.message('loadbang');ad.message('bang');
        if(writeValue!==undefined) {
            var input=make('flonum');
            p.connect(input,0,ad,['sr','sigvs','iovs'].indexOf(setting)>=0?1:0);
            input.message('float',writeValue);ad.message('bang');
        }
        var value=setting==='driver'?menu.getvalueof():sink.getvalueof();
        if(Array.isArray(value)&&value.length===1)value=value[0];
        if(typeof value!=='number'||value===-123456789)fail('Audio setting did not return a numeric value: '+setting);
        return {setting:setting,value:value,choices:safe(function(){return menu.getattr('items');}),writable:audioWritable.indexOf(setting)>=0};
    });
}
function audioSet(a) {
    if(audioWritable.indexOf(a.setting)<0)fail('Unsupported audio setting for writes');
    if(!Number.isFinite(a.value) || !Number.isFinite(a.expectedValue))fail('Finite value and expectedValue required');
    if(['switch','overdrive','takeover'].indexOf(a.setting)>=0 && [0,1].indexOf(a.value)<0)fail('Expected 0 or 1');
    if(a.setting==='cpulimit' && (a.value<0 || a.value>100))fail('CPU limit must be 0..100');
    if(['sr','sigvs','iovs'].indexOf(a.setting)>=0 && (!Number.isInteger(a.value)||a.value<1))fail('Expected positive integer');
    var before=audioProbe(a.setting);
    if(typeof before.value!=='number' || before.value!==a.expectedValue)fail('Audio setting changed or unavailable; read status before retrying');
    if(before.value===a.value)return {changed:false,before:before,after:before};
    var after=audioProbe(a.setting,a.value);
    if(after.value!==a.value)fail('Audio readback differs; outcome requires inspection, do not blindly retry');
    return {changed:true,before:before,after:after,scope:'Application-wide; may affect all open projects'};
}
function preferences(a) {
    var available=max.getattrnames();
    var names=a.names || available;
    if(!Array.isArray(names)||names.length>512)fail('Invalid preference names');
    var values={},unavailable=[];
    names.forEach(function(name){
        if(typeof name!=='string'||available.indexOf(name)<0){unavailable.push(name);return;}
        try {values[name]=max.getattr(name);} catch(e) {unavailable.push(name);}
    });
    return {values:values,unavailable:unavailable,available:available,
        coverage:'Attributes exposed by Max.getattrnames only; not every Preferences panel setting. Read-only.'};
}
function exportConsole(a) {
    if(typeof a.exportPath!=='string' || !a.exportPath || !/codex-max-console-[a-f0-9-]+\.txt$/.test(a.exportPath))fail('Console export requires a bridge-generated path');
    return withHelpers(function(p,make){
        make('console').message('write',a.exportPath);
        return {exported:true,coverage:'Current global Max Console history; not restricted to this project. Console is not cleared.'};
    });
}
function restartBridge(root) {
    var node=root.getnamed('__maxbridge_node');
    if(!node || !node.valid)fail('Bridge node not found in root');
    restartTasks=[new Task(function(){node.message('script','stop');}),new Task(function(){node.message('script','start');})];
    restartTasks[0].schedule(500);restartTasks[1].schedule(1500);
    return {scheduled:true,readSessionAgain:true};
}
