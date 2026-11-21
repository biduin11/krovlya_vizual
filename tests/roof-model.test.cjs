const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../prototype/index.html'), 'utf8');
const modelSource = html.slice(html.indexOf('function roofModel(){'), html.indexOf('/* ================= сборка'));
const liftSource = html.slice(html.indexOf('  const lift = new THREE.Vector3'), html.indexOf('  kit = { area:'));
// Only roofModel's vector operations are needed; no renderer or network dependency.
class Vector3 {
  constructor(x=0,y=0,z=0){ Object.assign(this,{x,y,z}); }
  add(v){ this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; }
}
for (const type of ['shed','gable','hip','pyramid','gambrel']) {
  test(`${type}: roof lift preserves shape and eave detection across parameter limits`, () => {
    for(const [W,L] of [[8,10],[14,5],[5,5],[14,18]]) for(const A of [10,30,55]) for(const O of [.2,.9]) {
      const context = vm.createContext({THREE:{Vector3}, S:{type,W,L,H:3.2,A,O}});
      vm.runInContext(modelSource + ';globalThis.M=roofModel();', context);
      const {M} = context;
      const before = new Map([...M.slopes.flat(), ...M.ridges.flat()].map(p=>[p,p.y]));
      vm.runInContext(liftSource, context);
      for(const [p,y] of before) assert.ok(Math.abs(p.y-y-.04)<1e-9, `${type} vertex must move exactly 4 cm`);
      let eaves=0;
      for(const pts of M.slopes) for(let i=0;i<pts.length;i++) {
        const a=pts[i],b=pts[(i+1)%pts.length];
        if(Math.abs(a.y-b.y)<1e-3 && Math.abs(a.y-M.y0)<1e-3) eaves++;
      }
      assert.equal(eaves, {shed:1,gable:2,hip:4,pyramid:4,gambrel:2}[type]);
    }
  });
}

test('changing material and RAL updates the scene caption immediately', () => {
  const elements = new Map();
  const material = () => ({color:{set(){} }});
  const context = vm.createContext({
    THREE:{Vector3}, roofSurfaceMeshes:[], skylightMeshes:[], needsRender:false,
    document:{getElementById(id){if(!elements.has(id)) elements.set(id,{});return elements.get(id);}},
    roofMat:material(), trimMat:material(), roofBackingMat:material(), wallMat:material(), plinthMat:material(),
    frameMat:material(), gutterMat:material(), doorMat:material(),
    U:{uProfile:{},uPer:{},uHeight:{},uMatteTexture:{}}, WU:{uKind:{}}
  });
  const data = html.slice(html.indexOf('const S ='), html.indexOf('/* configuration helpers */'));
  const look = html.slice(html.indexOf('function updateStats('), html.indexOf('/* ================= UI'));
  vm.runInContext(data + modelSource + look + ";S.mat='falz';S.ral='9003';applyLook();", context);
  assert.match(elements.get('stats').innerHTML, /Фальц, RAL 9003/);
});

test('rapid slider changes build once per frame using the latest state', () => {
  const frames=[];const built=[];
  const context=vm.createContext({tileQuality:'detail',requestAnimationFrame:cb=>frames.push(cb),build:()=>built.push(context.value)});
  const scheduling=html.slice(html.indexOf('let pendingBuild'),html.indexOf('// ширина ската'));
  vm.runInContext(scheduling+';scheduleBuild();value=1;scheduleBuild();value=2;',context);
  assert.equal(frames.length,1);
  frames.shift()();
  assert.deepEqual(built,[2]);
  vm.runInContext('scheduleBuild()',context);
  assert.equal(frames.length,1);
});


test('mansard eaves remain above 1.8 m at the smallest wall height', () => {
  const context=vm.createContext({THREE:{Vector3},S:{type:'gambrel',W:14,L:18,H:2.6,A:55,O:.9}});
  vm.runInContext(modelSource+';globalThis.M=roofModel()',context);
  assert.ok(context.M.y0>=1.8,'eaves must remain above the minimum clearance');
  assert.ok(context.M.effectiveOverhang>=.2 && context.M.effectiveOverhang<.9);
});

test('idle scene renders once and redraws after changes or camera movement',()=>{
  let frame,renders=0,moved=false;
  const context=vm.createContext({
    renderer:{setAnimationLoop(cb){frame=cb},render(){renders++}},
    controls:{autoRotate:false,update:()=>moved},
    sky:{position:{copy(){}}},camera:{position:{}},scene:{},needsRender:true,skylightDrag:null
  });
  const start=html.lastIndexOf('renderer.setAnimationLoop(');
  vm.runInContext(html.slice(start,html.indexOf('} catch(error)',start)),context);
  frame();frame();frame();assert.equal(renders,1);
  context.needsRender=true;frame();assert.equal(renders,2);
  moved=true;frame();assert.equal(renders,3);
  moved=false;context.controls.autoRotate=true;frame();frame();assert.equal(renders,5);
});
