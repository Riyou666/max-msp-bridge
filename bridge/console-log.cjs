const fs = require('node:fs');
const {TextDecoder} = require('node:util');

function readConsoleTail(filename, {limit=100, contains=''}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('Console limit must be 1..500');
  const file=fs.openSync(filename,'r');
  try {
    const size=fs.fstatSync(file).size;
    const cap=1024*1024, offset=Math.max(0,size-cap), bytes=Buffer.alloc(size-offset);
    fs.readSync(file,bytes,0,bytes.length,offset);
    let text=new TextDecoder('utf-8').decode(bytes);
    if(offset)text=text.slice(text.indexOf('\n')+1);
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
    if(lines.at(-1)==='')lines.pop();
    const filtered=contains?lines.filter(line=>line.includes(contains)):lines;
    return {lines:filtered.slice(-limit),truncated:offset>0||filtered.length>limit,bytes:size,
      coverage:'Current global Max Console history, not project-scoped; tail limited to 1 MiB and requested lines. No messages cleared.'};
  } finally {fs.closeSync(file);}
}

async function collectConsole(filename,args) {
  let previous=-1;
  try {
    for(let attempt=0;attempt<30;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,50));
      if(!fs.existsSync(filename))continue;
      const size=fs.statSync(filename).size;
      if(size===previous)return readConsoleTail(filename,args);
      previous=size;
    }
    throw Error('Console export did not settle; try reading again');
  } finally {try {fs.unlinkSync(filename);} catch {}}
}
module.exports={readConsoleTail,collectConsole};
