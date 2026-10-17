const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function editor(){
  const nodes=new Map(),sent=[];
  const node=()=>({value:'0',defaultValue:'0',dataset:{},children:[],setAttribute(){},replaceChildren(...children){this.children=children;},reportValidity(){return true;}});
  const document={activeElement:null,getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,querySelectorAll(){return [];}};
  const context=vm.createContext({document,setTimeout(){},fetch:async(url,options)=>{
    if(url.endsWith('/status'))return new Promise(()=>{});
    sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({id:'closing-command'})};
  }});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/native.js'),'utf8'),context);
  function sync(state,lastCommand){
    context.testDevice={id:'phone',online:true,state:{active:true,ready:true,screen:'ar',selected:100,side:140,panelList:[],depthCoverage:-1,mappedSurfaces:0,...state},lastCommand};
    document.getElementById('device').value='phone';
    vm.runInContext('devices=[testDevice];render();',context);
  }
  return {context,nodes,sent,sync};
}

test('PC exit remains available when AR fails with another command pending',async()=>{
  const ui=editor();ui.sync({ready:false},{id:'stuck',action:'larger',status:'pending'});
  assert.equal(ui.nodes.get('close').disabled,false);
  assert.equal(ui.nodes.get('editor').disabled,true);
  assert.equal(ui.nodes.get('open').disabled,true);
  assert.equal(await ui.context.command('place'),false);
  assert.equal(await ui.context.command('close_ar'),true);
  assert.deepEqual(ui.sent,[{device:'phone',action:'close_ar'}]);
  ui.sync({screen:'home'});assert.equal(ui.nodes.get('close').disabled,true);
  ui.sync({active:false,ready:false});assert.equal(ui.nodes.get('close').disabled,true);
});

test('PC panel label refreshes when tracking changes without a size or name change',()=>{
  const ui=editor(),panel={id:'p1',name:'Painel 1',size:.65,tracked:false};
  ui.sync({panelList:[panel],selectedPanel:'p1'});
  assert.match(ui.nodes.get('panel').children[0].textContent,/sem pose/);
  ui.sync({panelList:[{...panel,tracked:true}],selectedPanel:'p1'});
  assert.match(ui.nodes.get('panel').children[0].textContent,/rastreado/);
  ui.sync({panelList:[panel],selectedPanel:'p1'});
  assert.match(ui.nodes.get('panel').children[0].textContent,/sem pose/);
});
