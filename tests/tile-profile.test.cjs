const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function profile(){const s=fs.readFileSync('prototype/index.html','utf8');const a=s.indexOf('/* tile profile */');assert.ok(a>=0,'physical tile profile exists');const c=vm.createContext({});vm.runInContext(s.slice(a,s.indexOf('/* end tile profile */',a))+';globalThis.height=tileHeight;',c);return c.height;}
test('tile has periodic longitudinal waves and transverse courses',()=>{const h=profile();for(const u of [-1.13,0,.024,.09,.4])for(const v of [-.6,0,.005,.15,.345]){assert.ok(Math.abs(h(u,v)-h(u+.1835,v))<1e-10);assert.ok(Math.abs(h(u,v)-h(u,v+.35))<1e-10);}});
test('pressed step has a steep face and broad pan, within 61 mm relief',()=>{const h=profile();const steep=(h(0,.009)-h(0,0))/.009;const pan=Math.abs(h(0,.2)-h(0,.1))/.1;assert.ok(steep>pan*5,'step must be sharper than pan');for(let u=0;u<.1835;u+=.003)for(let v=0;v<.35;v+=.003){const z=h(u,v);assert.ok(z>=0 && z<=.061+1e-9);}});

test('Monterrey matches the specified wave and course heights',()=>{
 const h=profile(), trough=.1835/2, lip=.35*.018;
 assert.ok(Math.abs(h(0,0)-h(trough,0)-.036)<1e-9);
 assert.ok(Math.abs(h(0,lip)-h(0,0)-.025)<1e-9);
 assert.ok(Math.abs(h(trough,lip)-h(trough,0)-.025)<1e-9);
});

test('relief mesh stays inside rectangular, hip and triangular slopes with finite vertices',()=>{
 const html=fs.readFileSync('prototype/index.html','utf8');
 class Geometry{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}setIndex(v){this.index=v;}computeBoundingSphere(){}}
 class Attribute{constructor(array,size){this.array=array;this.itemSize=size;}}
 const c=vm.createContext({THREE:{BufferGeometry:Geometry,Float32BufferAttribute:Attribute}});
 vm.runInContext(html.slice(html.indexOf('/* tile profile */'),html.indexOf('function flatGeometry'))+html.slice(html.indexOf('function spanAt('),html.indexOf('function build(){'))+';globalThis.make=roofReliefGeometry;',c);
 for(const uv of [[[0,0],[4,0],[4,3],[0,3]],[[0,0],[4,0],[3,3],[1,3]],[[0,0],[4,0],[2,3]]]){
  const s={uv,o:{x:0,y:0,z:0},U:{x:1,y:0,z:0},V:{x:0,y:.6,z:-.8},n:{x:0,y:.8,z:.6}};
  for(const material of [{prof:0,per:.1835,height:.061},{prof:3,per:.183,height:.045},{prof:1,per:.1,height:.021},{prof:1,per:.2,height:.035}]){
   const g=c.make(s,material),p=g.attributes.position.array,m=g.attributes.aM.array;
   assert.ok(p.length>100,'surface must contain physical relief');
   assert.ok(p.every(Number.isFinite));
   assert.ok(g.index.every(i=>Number.isInteger(i)&&i>=0&&i<p.length/3));
   let maxHeight=0;
   for(let i=0;i<p.length/3;i++){
    const u=m[i*2],v=m[i*2+1],height=p[i*3+1]*.8+p[i*3+2]*.6;
    assert.ok(u>=-1e-8&&u<=4+1e-8&&v>=-1e-8&&v<=3+1e-8);
    assert.ok(height>=-1e-8&&height<=material.height+1e-8);
    assert.ok(Math.abs(g.attributes.reliefHeight.array[i]-height)<1e-8);
    maxHeight=Math.max(maxHeight,height);
   }
   assert.ok(maxHeight>material.height*.87,'mesh must reach the raised lip');
  }
 }
});
