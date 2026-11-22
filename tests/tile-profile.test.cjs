const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function profile(){const s=fs.readFileSync('prototype/index.html','utf8');const a=s.indexOf('/* tile profile */');assert.ok(a>=0,'physical tile profile exists');const c=vm.createContext({});vm.runInContext(s.slice(a,s.indexOf('/* end tile profile */',a))+';globalThis.height=tileHeight;',c);return c.height;}
test('standing seam uses 515 mm panels, a single high lock and four distinct pan variants',()=>{
 const html=fs.readFileSync('prototype/index.html','utf8'),a=html.indexOf('/* tile profile */'),c=vm.createContext({});
 vm.runInContext(html.slice(a,html.indexOf('/* end tile profile */',a)),c);
 assert.equal(typeof c.falzHeight,'function');
 const h=c.falzHeight;
 for(const pan of ['plain','ribs','narrow','wide'])for(const u of [-.6,0,.002,.17,.26,.4]){
  assert.ok(Math.abs(h(u,0,pan)-h(u+.515,2,pan))<1e-10,'continuous 515 mm panels');
 }
 assert.ok(h(.001,0,'plain')>.029,'high standing lock');
 assert.equal(h(.1,0,'plain'),h(.2575,0,'plain'),'smooth broad pan');
 assert.ok(h(.515/3,0,'ribs')-h(.12,0,'ribs')>.002,'two raised round ribs');
 assert.ok(h(.515/3,0,'narrow')-h(.12,0,'narrow')>.001,'two narrow flat bands');
 assert.ok(h(.2575,0,'wide')-h(.12,0,'wide')>.001,'single wide centre band');
});
test('Falznastil has a full-depth channel between paired seam ribs and flat pans',()=>{
 const html=fs.readFileSync('prototype/index.html','utf8'),a=html.indexOf('/* tile profile */'),c=vm.createContext({});
 vm.runInContext(html.slice(a,html.indexOf('/* end tile profile */',a)),c);
 assert.equal(typeof c.falznastilHeight,'function');
 const h=c.falznastilHeight;
 for(const u of [-.7,0,.005,.12,.3,.51])for(const v of [0,.15,.7]){
  assert.ok(Math.abs(h(u,v)-h(u+.51,v))<1e-10,'510 mm repeating panel');
  assert.equal(h(u,v),h(u,v+1),'no transverse tile courses');
 }
 assert.ok(h(.009,0)>.029,'high seam crest');
 assert.ok(h(.015,0)>.026,'second fold in the lock');
 assert.ok(h(0,0)<.002,'centre of the lock drops to the sheet level');
 assert.ok(h(.105,0)<h(.08,0),'fine groove in the flat pan');
 for(const v of [0,.1,2]){
  assert.ok(h(.009,v)-h(0,v)>.027,'deep channel reaches the eave');
  assert.ok(Math.abs(h(.08,v)-h(.255,v))<1e-10,'wide pan stays flat');
  assert.ok(Math.abs(h(-.009,v)-h(.009,v))<1e-10,'two seam ribs flank the central channel');
 }
 assert.ok(Math.abs(h(.034-1e-6,0)-h(.034+1e-6,0))<1e-6,'seam foot joins the pan without a gap');
});
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
  for(const material of [{prof:0,per:.1835,height:.061},{prof:3,per:.183,height:.045},{prof:4,per:.255,height:.074},{prof:1,per:.1,height:.021},{prof:1,per:.2,height:.035},{prof:5,per:.510,height:.030},...['plain','ribs','narrow','wide'].map(pan=>({prof:2,per:.515,height:.030,pan}))]){
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

test('overview mesh respects a 32000 triangle budget even for a large slope',()=>{
 const html=fs.readFileSync('prototype/index.html','utf8');
 class Geometry{constructor(){this.attributes={}}setAttribute(k,v){this.attributes[k]=v}setIndex(v){this.index=v}computeBoundingSphere(){}}
 class Attribute{constructor(array,size){this.array=array;this.itemSize=size}}
 const c=vm.createContext({THREE:{BufferGeometry:Geometry,Float32BufferAttribute:Attribute}});
 vm.runInContext(html.slice(html.indexOf('/* tile profile */'),html.indexOf('function flatGeometry'))+html.slice(html.indexOf('function spanAt('),html.indexOf('function build(){'))+';globalThis.make=roofReliefGeometry;',c);
 const s={uv:[[0,0],[20,0],[20,16],[0,16]],o:{x:0,y:0,z:0},U:{x:1,y:0,z:0},V:{x:0,y:.6,z:-.8},n:{x:0,y:.8,z:.6}};
 for(const material of [{prof:0,per:.1835,height:.061},{prof:3,per:.183,height:.045},{prof:4,per:.255,height:.074}]){
  const overview=c.make(s,material,'overview'),detail=c.make(s,material,'detail');
  assert.ok(overview.index.length/3<=32000,'overview exceeds triangle budget');
  assert.ok(detail.index.length>overview.index.length,'close-up should retain more detail');
  assert.ok(detail.index.length/3<=96000,'close-up exceeds triangle budget');
 }
});

test('Bavaria: 255 mm pitch, 44 mm wave, 30 mm step (74 mm profile), round convex crest, R60 into a flat pan',()=>{
 const s=fs.readFileSync('prototype/index.html','utf8'),a=s.indexOf('/* tile profile */');
 const c=vm.createContext({});vm.runInContext(s.slice(a,s.indexOf('/* end tile profile */',a))+';globalThis.h=bavariaHeight;globalThis.B=bavariaSection();',c);const h=c.h,B=c.B;
 const mid=.2;// середина ряда: ступень уже сошла на нет
 for(const u of [0,.05,.1,.17])for(const v of [.01,.1,.3]){
  assert.ok(Math.abs(h(u,v)-h(u+.255,v))<1e-10);assert.ok(Math.abs(h(u,v)-h(u,v+.35))<1e-10);
  assert.ok(Math.abs(h(u,v)-h(u+1.02,v))<1e-10,'4 waves on the 1020 mm useful width');
 }
 const trough=h(.1275,mid);
 assert.ok(Math.abs(h(0,mid)-trough-.044)<1e-9,'wave height 44 mm');
 assert.ok(Math.abs(h(.1275,.35*.06)-h(.1275,0)-.030)<1e-9,'course step 30 mm');
 assert.ok(Math.abs(h(0,.35*.06)-h(.1275,0)-.074)<1e-9,'full profile height 74 mm');
 // гребень выпуклый от вершины до перегиба: без плоской вершины и прямых участков
 assert.ok(h(0,mid)-h(.012,mid)>.0004,'crest has no flat top');
 for(let u=.002;u<=B.a1-.002;u+=.002) assert.ok(h(u-.002,mid)+h(u+.002,mid)-2*h(u,mid)<-1e-7,'crest is convex at '+u.toFixed(3));
 for(let u=.1095;u<=.1455;u+=.004) assert.ok(Math.abs(h(u,mid)-trough)<1e-9,'flat pan 36 mm');
 assert.ok(Math.abs(B.Rt-.060)<1e-12,'R60 into the pan');
  // самый крутой участок — точка перегиба между дугами, около 44°
 const slope=(h(B.a1-.0001,mid)-h(B.a1+.0001,mid))/.0002;
 assert.ok(Math.abs(Math.atan(slope)*180/Math.PI-43.8)<0.5,'flank angle');
 for(let u=.001;u<.127;u+=.0005){const d1=(h(u,mid)-h(u-.0005,mid))/.0005,d2=(h(u+.0005,mid)-h(u,mid))/.0005;assert.ok(Math.abs(d1-d2)<.05,'no kink at '+u.toFixed(4));}
});
