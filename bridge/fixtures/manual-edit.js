// Isolated live regression fixture, not part of the distributed bridge.
inlets=1;outlets=0;
function bang(){
  var p=this.patcher,o=p.getnamed('ownedReplacementProbe');
  if(o){p.remove(o);var replacement=p.newdefault(500,400,'number');replacement.varname='ownedReplacementProbe';}
  var a=p.newdefault(500,450,'number'),b=p.newdefault(500,500,'number');p.connect(a,0,b,0);
}
