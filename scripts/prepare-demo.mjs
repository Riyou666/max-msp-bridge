import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.resolve(process.argv[2]||path.join(root,'max-control.maxpat'));
const box=(id,maxclass,text,x,y,w,extra={})=>({box:{id,maxclass,...(text?{text}:{}),patching_rect:[x,y,w,22],...extra}});
const line=(s,o,d,i)=>({patchline:{source:[s,o],destination:[d,i]}});
const slash=p=>p.replaceAll('\\','/');
const patcher={fileversion:1,appversion:{major:9,minor:2,revision:0,architecture:'x64',modernui:1},classnamespace:'box',rect:[80,80,1050,720],default_fontsize:13,
  boxes:[
    box('title','comment','MAX / CODEX — live Windows bridge',30,20,650,{fontsize:23}),
    box('instructions','comment','Double-click the workspace below. Codex creates and edits real objects there. No audio output is enabled.',30,62,900),
    box('start','message','script start',30,108,100,{numinlets:2,numoutlets:1,varname:'__maxbridge_start'}),
    box('stop','message','script stop',155,108,100,{numinlets:2,numoutlets:1,varname:'__maxbridge_stop'}),
    box('node','newobj',`node.script "${slash(path.join(root,'bridge','max-node.js'))}" @autostart 1`,30,160,890,{numinlets:1,numoutlets:2,varname:'__maxbridge_node',saved_object_attributes:{autostart:1,defer:1,watch:0}}),
    box('status','newobj','print max-bridge-status',620,285,250,{numinlets:1,numoutlets:0,varname:'__maxbridge_status'}),
    box('receiver','newobj',`v8 "${slash(path.join(root,'bridge','max-receiver.js'))}"`,30,220,890,{numinlets:1,numoutlets:1,varname:'__maxbridge_receiver'}),
    box('workspace','newobj','p codex_workspace',30,300,200,{numinlets:0,numoutlets:0,varname:'workspace',patcher:{fileversion:1,classnamespace:'box',rect:[130,130,1000,650],default_fontsize:13,boxes:[
      box('label','comment','CODEX WORKSPACE — live objects appear below',30,20,700,{fontsize:21,varname:'workspaceLabel'}),
      box('note','comment','Bridge inspection and edits are scoped to this subpatcher. Audio audition is a separate step.',30,60,800,{varname:'workspaceNote'})
    ],lines:[]}})
  ],lines:[line('start',0,'node',0),line('stop',0,'node',0),line('node',0,'receiver',0),line('receiver',0,'node',0),line('node',1,'status',0)]};
fs.writeFileSync(destination,JSON.stringify({patcher},null,2)+'\n',{flag:'wx'});
console.log(destination);
