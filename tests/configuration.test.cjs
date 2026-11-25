const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function load(){
 const html=fs.readFileSync('prototype/index.html','utf8');
 const start=html.indexOf('/* configuration helpers */');
 assert.ok(start>=0,'configuration helpers must exist');
 const code=html.slice(start,html.indexOf('/* end configuration helpers */',start));
 const context=vm.createContext({});vm.runInContext(code+';globalThis.api={encodeConfiguration,decodeConfiguration};',context);return context.api;
}
test('configuration round trips all options and camera',()=>{
 const api=load(), state={type:'hip',mat:'falz',coat:'matt',ral:'9003',W:14,L:5,H:7,A:55,O:.9,facade:9,plinth:3,frames:2,trims:false,snow:false,gutter:true,trees:false,hour:19.5,skyN:3,skyPos:.8,skylights:{'0:1':[1.25,2.5]},gutCol:'7024'};
 const camera={position:[20,15,30],target:[0,4,0]};
 const decoded=api.decodeConfiguration(api.encodeConfiguration(state,camera));
 assert.deepEqual(JSON.parse(JSON.stringify(decoded)),{state,camera});
});
test('standing seam pan variants survive links and reject unsupported variants',()=>{
 const api=load();
 for(const falzPan of ['plain','ribs','narrow','wide']){
  const state={mat:'falz',falzPan};
  assert.equal(api.decodeConfiguration(api.encodeConfiguration(state,null)).state.falzPan,falzPan);
 }
 assert.equal(api.decodeConfiguration(api.encodeConfiguration({mat:'falz',falzPan:'invalid'},null)).state.falzPan,undefined);
});
test('untrusted configurations discard invalid values and unknown properties',()=>{
 const api=load();const result=api.decodeConfiguration(encodeURIComponent(JSON.stringify({v:1,state:{type:'invalid',W:100,L:8,H:null,A:'55',trees:'false',ral:'<script>',skyN:1.5,mat:'falz',unknown:1},camera:{position:[Infinity,0,0],target:[0,0,0]}})));
 assert.equal(JSON.stringify(result.state),JSON.stringify({L:8,mat:'falz'}));assert.equal(result.camera,null);
});
test('broken or future-version links safely return defaults',()=>{
 const api=load();for(const input of ['%bad','null','',encodeURIComponent('{"v":2}'),encodeURIComponent('[]')]) assert.equal(api.decodeConfiguration(input),null);
});

test('skylight positions accept only supported window keys and finite coordinates',()=>{
 const api=load();
 const state={skylights:{'0:0':[1,2],'3:2':[-10,4],'4:0':[1,2],'0:3':[1,2],'1:0':[null,2],'2:0':[51,2],'2:2':[1,2,3]}};
 const decoded=api.decodeConfiguration(api.encodeConfiguration(state));
 assert.deepEqual(JSON.parse(JSON.stringify(decoded.state)),{skylights:{'0:0':[1,2],'3:2':[-10,4]}});
});

test('both new and original roofing profile links retain their profile',()=>{
 const api=load();
 for(const mat of ['tile','cascade','bavaria','c21','prof','falz','falznastil']){
  assert.equal(api.decodeConfiguration(api.encodeConfiguration({mat},null)).state.mat,mat);
 }
});

test('ridge style is preserved in shared links and unknown styles are ignored',()=>{
 const api=load();
 for(const ridgeStyle of ['round','rect']){
  assert.equal(api.decodeConfiguration(api.encodeConfiguration({ridgeStyle},null)).state.ridgeStyle,ridgeStyle);
 }
 assert.equal(api.decodeConfiguration(api.encodeConfiguration({ridgeStyle:'invalid'},null)).state.ridgeStyle,undefined);
});

test('legacy roof vent links are migrated to a count',()=>{
 const api=load();
 for(const vent of [true,false]){
  assert.equal(api.decodeConfiguration(api.encodeConfiguration({vent},null)).state.ventN,Number(vent));
 }
 assert.equal(api.decodeConfiguration(api.encodeConfiguration({vent:'true'},null)).state.ventN,undefined);
});

test('vent count and coordinates are preserved and invalid placements are ignored',()=>{
 const api=load(), state={ventN:3,vents:{0:[1,-2,2.5],2:[3,1,3],3:[4,0,3],6:[0,0,3],1:[0,0,'3']}};
 const decoded=api.decodeConfiguration(api.encodeConfiguration(state,null)).state;
 assert.deepEqual(JSON.parse(JSON.stringify(decoded)),{ventN:3,vents:{0:[1,-2,2.5],2:[3,1,3]}});
 assert.equal(api.decodeConfiguration(api.encodeConfiguration({vent:true,ventN:0},null)).state.ventN,0);
});

test('per-slope counts and vent positions survive shared links',()=>{
 const api=load();
 const state={slopeWindows:[0,2,0,1],slopeVents:[2,0,0,1],vents:{'0:1':[0,2,3],'3:0':[3,1,3],'4:0':[3,1,3]}};
 const decoded=api.decodeConfiguration(api.encodeConfiguration(state,null)).state;
 assert.deepEqual(JSON.parse(JSON.stringify(decoded)),{...state,vents:{'0:1':[0,2,3],'3:0':[3,1,3]}});
 const invalid=api.decodeConfiguration(api.encodeConfiguration({slopeWindows:[4],slopeVents:[1,0.5]},null)).state;
 assert.equal(invalid.slopeWindows,undefined);
 assert.equal(invalid.slopeVents,undefined);
});

test('fence and both bay settings survive shared links',()=>{
 const api=load();
 for(const fence of ['none','corrugated','picket','siding','louver']) for(const fencePost of ['metal','stone']){
  const state={fence,fencePost,fenceRal:'6005',bayFaces:['front','left'],slopeDormers:[0,3]};
  const decoded=api.decodeConfiguration(api.encodeConfiguration(state,null)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(decoded)),state);
 }
 const invalid=api.decodeConfiguration(api.encodeConfiguration({
  fence:'invalid',fencePost:3,fenceRal:'invalid',bayFaces:['front','front','garage'],slopeDormers:[1,4,'2']
 },null)).state;
 assert.deepEqual(JSON.parse(JSON.stringify(invalid)),{bayFaces:['front'],slopeDormers:[1]});
});
