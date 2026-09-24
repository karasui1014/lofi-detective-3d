import * as T from 'three';
// Authored surfaces for Tsukuyo: continuous face, sculpted locks and tailored clothes.
const mats=new Map();
function mat(c){if(!mats.has(c))mats.set(c,new T.MeshStandardMaterial({color:c,roughness:.87,side:T.DoubleSide}));return mats.get(c);}
function add(p,g,m,pos=[0,0,0]){const o=new T.Mesh(g,m);o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
function surface(p,fn,nu,nv,m){const a=[],idx=[];for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++)a.push(...fn(u/nu,v/nv));for(let v=0;v<nv;v++)for(let u=0;u<nu;u++){const i=v*(nu+1)+u;idx.push(i,i+1,i+nu+1,i+1,i+nu+2,i+nu+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));g.setIndex(idx);g.computeVertexNormals();return add(p,g,m);}
function ell(p,s,m,pos){const o=add(p,new T.SphereGeometry(1,32,24),m,pos);o.scale.set(...s);return o;}
function line(p,pts,r,m){return add(p,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(a=>new T.Vector3(...a))),32,r,6,false),m);}
function rounded(p,w,h,d,r,m,pos){const s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return add(p,new T.ExtrudeGeometry(s,{depth:d-2*r,steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,curveSegments:8}),m,[pos[0],pos[1],pos[2]-d/2+r]);}
function panel(p,points,m){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const o=add(p,new T.ExtrudeGeometry(s,{depth:.012,bevelEnabled:true,bevelSize:.006,bevelThickness:.005,bevelSegments:2}),m);return o;}
function loft(p,rows,m,segments=48,start=0,end=Math.PI*2){return surface(p,(u,v)=>{const q=v*(rows.length-1),i=Math.min(rows.length-2,Math.floor(q)),f=q-i;const r=rows[i].map((x,j)=>{const a=rows[Math.max(0,i-1)][j]||0,b=x||0,c=rows[i+1][j]||0,d=rows[Math.min(rows.length-1,i+2)][j]||0;return .5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);});const a=start+u*(end-start),fold=1+(r[4]||0)*Math.cos(a*10);return [Math.sin(a)*r[1]*fold,r[0],Math.cos(a)*r[2]*fold+(r[3]||0)];},segments,(rows.length-1)*5,m);}
function lock(p,pts,width,depth,colors){const curve=new T.CatmullRomCurve3(pts.map(a=>new T.Vector3(...a)));const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.92,side:T.DoubleSide});const o=surface(p,(u,v)=>{const c=curve.getPoint(v),t=curve.getTangent(v),side=new T.Vector3(t.y,-t.x,0).normalize();const w=width*(.5+.7*Math.sin(v*Math.PI))*(1-Math.pow(v,3))+.0005;const a=u*Math.PI*2;return c.addScaledVector(side,Math.cos(a)*w).add(new T.Vector3(0,0,Math.sin(a)*depth*Math.sin(v*Math.PI))).toArray();},12,24,m);const cs=[];const dark=new T.Color(colors[0]),tip=new T.Color(colors[1]);for(let v=0;v<=24;v++)for(let u=0;u<=12;u++){const f=T.MathUtils.smoothstep(v/24,.52,1);const c=dark.clone().lerp(tip,f).multiplyScalar(.94+.08*Math.sin(u/12*Math.PI*2));cs.push(c.r,c.g,c.b);}o.geometry.setAttribute('color',new T.Float32BufferAttribute(cs,3));return o;}
export function createDetective({ghost=false}={}){
 const root=new T.Group();root.name='Akari Tsukuyo — sculpted edition';const body=new T.Group();root.add(body);body.position.y=-.115;
 const coat=mat(0xc3aa8c),fold=mat(0x9b836b),edge=mat(0x776550),cream=mat(0xe9dfcc),skin=mat(0xf4ceb0),hair=mat(0x292c2c),ink=mat(0x302d2c),teal=mat(0x558b88),pants=mat(0x41423f),shoe=mat(0x292c2a),gold=mat(0xa48a55);
 const legs=[],arms=[],tails=[];
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.132,.78,0);body.add(leg);legs.push(leg);
  loft(leg,[[0,.119,.122,0,.03],[-.12,.116,.118,0,.025],[-.3,.105,.105,0,.015],[-.48,.102,.103,0,.02]],pants);
  loft(leg,[[-.44,.106,.106,0],[-.50,.109,.109,0]],mat(0x50504b));
  loft(leg,[[-.5,.05,.056,0],[-.56,.047,.052,0]],cream);
  const boot=rounded(leg,.19,.09,.285,.032,shoe,[0,-.594,.046]);
  rounded(leg,.195,.028,.292,.012,mat(0x191c1b),[0,-.639,.046]);
  ell(leg,[.094,.063,.108],shoe,[0,-.561,.012]);
  for(let i=0;i<3;i++)line(leg,[[-.048,-.549-i*.006,.052+i*.025],[0,-.54-i*.009,.062+i*.025],[.048,-.549-i*.006,.052+i*.025]],.005,mat(0x777264));
  line(leg,[[-.075,-.61,.14],[0,-.607,.183],[.075,-.61,.14]],.003,mat(0xaaa18b));
  line(leg,[[side*.025,-.1,.12],[side*.035,-.24,.112],[side*.024,-.42,.109]],.003,mat(0x626057));
 }
 loft(body,[[.99,.188,.14,0],[1.04,.188,.14,0],[1.18,.201,.15,0],[1.32,.226,.14,0],[1.40,.108,.102,0]],cream);
 loft(body,[[.73,.227,.145,0],[.91,.208,.14,0],[1.0,.191,.14,0]],pants);
 // Open front: one continuous curved shell with a real gap and inner lining.
 loft(body,[[.55,.305,.222,-.025,.035],[.70,.28,.207,-.019,.025],[1.0,.225,.164,0,.012],[1.24,.246,.159,0],[1.34,.253,.138,-.01],[1.4,.119,.106,-.01]],coat,64,.34,Math.PI*2-.34);
 for(const side of [-1,1]){
  line(body,[[side*.104,.55,.183],[side*.092,.75,.183],[side*.077,1,.164],[side*.083,1.2,.161]],.008,fold);
  const lapel=panel(body,[[side*.09,1.41],[side*.233,1.305],[side*.18,1.276],[side*.212,1.205],[side*.075,1.075],[side*.123,1.287]],coat);lapel.position.z=.168;
  line(body,[[side*.09,1.41,.187],[side*.233,1.305,.187],[side*.18,1.276,.187],[side*.212,1.205,.187],[side*.075,1.075,.187]],.0035,edge);
  for(const y of [.80,1.015,1.195])ell(body,[.012,.019,.005],ink,[side*.151,y,.193]);
  line(body,[[side*.162,.92,.192],[side*.221,.86,.143]],.008,fold);
  const shoulder=new T.Group();shoulder.position.set(side*.243,1.305,0);body.add(shoulder);
  loft(shoulder,[[.035,.057,.076,0],[-.035,.099,.093,0],[-.18,.089,.085,.01],[-.27,.076,.071,.02]],coat,28);
  shoulder.rotation.z=side*.13;
  const elbow=new T.Group();elbow.position.set(0,-.25,.02);shoulder.add(elbow);
  loft(elbow,[[0,.078,.075,0],[-.09,.083,.079,.022],[-.2,.067,.06,.033],[-.245,.069,.063,.033]],coat,28);
  loft(elbow,[[-.204,.074,.069,.033],[-.246,.074,.069,.033]],fold,28);
  ell(elbow,[.047,.075,.039],skin,[0,-.292,.042]);ell(elbow,[.025,.043,.027],skin,[-side*.04,-.277,.063]);
  for(const y of [-.05,-.14])line(elbow,[[-.063,y,.049],[0,y+.02,.095],[.06,y+.025,.05]],.003,fold);
  ell(elbow,[.012,.015,.006],gold,[0,-.221,.104]);arms.push({shoulder,elbow,side});
 }
 // Knit neck, ribs and waist belt remain visible through the open coat.
 loft(body,[[1.32,.113,.104,0],[1.42,.096,.089,0],[1.47,.102,.091,0]],cream);
 for(let i=-4;i<=4;i++){const x=i*.019;line(body,[[x,1.365,.1],[x,1.44,Math.sqrt(Math.max(0,.01-x*x))]],.0025,mat(0xc4b9a4));}
 rounded(body,.38,.035,.02,.005,mat(0x4b4033),[0,1.0,.146]);rounded(body,.064,.051,.02,.006,gold,[0,1,.165]);rounded(body,.042,.03,.025,.004,mat(0x393a33),[0,1,.18]);
 line(body,[[-.19,1.18,-.12],[0,1.16,-.174],[.19,1.18,-.12]],.009,fold);
 line(body,[[0,1.17,-.177],[0,.88,-.202],[0,.56,-.253]],.003,fold);
 // The face is a single continuous jaw/cheek/forehead surface, not a sphere.
 const head=new T.Group();head.position.set(0,1.697,0);body.add(head);
 loft(head,[[-.27,.018,.035,.07],[-.25,.105,.105,.07],[-.21,.191,.152,.062],[-.155,.254,.186,.052],[-.08,.286,.209,.04],[.02,.29,.216,.027],[.13,.283,.22,.01],[.23,.247,.195,0],[.29,.158,.137,0],[.31,.003,.002,0]],skin,64);
 // Smooth underlying bob shell, with shaped strands along the visible silhouette.
 loft(head,[[-.215,.208,.165,-.054],[-.16,.287,.235,-.046],[.04,.318,.274,-.035],[.22,.294,.25,-.027],[.31,.207,.192,-.012],[.335,.001,.001,0]],hair,56,.90,Math.PI*2-.9);
 for(const side of [-1,1])ell(head,[.037,.061,.03],skin,[side*.281,-.065,.07]);
 for(let i=0;i<15;i++){
  const a=.96+i/(14)*(Math.PI*2-1.92),s=Math.sin(a),c=Math.cos(a),j=Math.sin(i*7)*.016;
  lock(head,[[s*.26,.23,c*.232-.027],[s*.31,.06,c*.266-.025],[s*.318,-.17,c*.276-.015],[s*(.322+j),-.274-j,c*.25+.01]],.055,.019,[0x2a2e2e,0x689691]);
 }
 // Eyes sit against the face: almond white, layered iris and an upper lash contour.
 function faceZ(x,y){return .027+.216*Math.sqrt(Math.max(.15,1-(x/.302)**2))-(Math.max(0,-y-.08))*.36;}
 function eyePatch(cx,cy,rx,ry,m,raise=0){return surface(head,(u,v)=>{const a=u*Math.PI*2,r=v,x=cx+Math.cos(a)*rx*r,y=cy+Math.sin(a)*ry*r;return[x,y,faceZ(x,y)+raise];},48,8,m);}
 for(const side of [-1,1]){
  const x=side*.119;eyePatch(x,-.021,.072,.087,mat(0xfff4e5),.005);
  eyePatch(x,-.025,.049,.068,mat(0x31595b),.008);eyePatch(x,-.035,.039,.049,teal,.010);eyePatch(x,-.024,.023,.052,mat(0x183638),.012);
  eyePatch(x-.016,.005,.013,.02,mat(0xffffff),.015);eyePatch(x+.02,-.058,.006,.008,mat(0xc8ddd0),.015);
  const lash=[];for(let i=0;i<=12;i++){const a=i/12*Math.PI,xx=x+Math.cos(a)*.073,yy=-.021+Math.sin(a)*.088;lash.push([xx,yy,faceZ(xx,yy)+.012]);}line(head,lash,.0065,ink);
  line(head,[[side*.175,.027,faceZ(side*.175,.027)+.011],[side*.202,.04,faceZ(side*.202,.04)+.009]],.005,ink);
  line(head,[[side*.064,.111,faceZ(side*.064,.111)+.005],[side*.119,.126,faceZ(side*.119,.126)+.005],[side*.175,.113,faceZ(side*.175,.113)+.005]],.005,mat(0x60534b));
  const ring=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,xx=x+Math.cos(a)*.098,yy=-.025+Math.sin(a)*.103;ring.push([xx,yy,.278-Math.abs(xx)*.20]);}line(head,ring,.0045,mat(0x5b4d39));
  line(head,[[side*.216,-.012,.232],[side*.288,.002,.157],[side*.294,-.013,.062]],.0045,mat(0x5b4d39));
  // Long side locks curl out at the tip and frame the cheek.
  lock(head,[[side*.254,.225,.136],[side*.292,.075,.157],[side*.278,-.14,.179],[side*.303,-.292,.183]],.036,.019,[0x262b2c,0x739f96]);
 }
 line(head,[[-.021,-.008,.271],[0,.007,.275],[.021,-.008,.271]],.004,mat(0x5b4d39));
 ell(head,[.014,.018,.012],skin,[0,-.104,.235]);line(head,[[-.026,-.177,.238],[0,-.184,.239],[.027,-.176,.238]],.0028,mat(0xa16b5b));
 // Swept, tapered bangs, each with a broad root and pointed end.
 const bangs=[[-.205,-.251,.068],[-.13,-.197,.087],[-.046,-.119,.074],[.054,-.035,.092],[.132,.115,.063],[.203,.216,.045]];
 for(const [a,b,w] of bangs)lock(head,[[a*.65,.30,.156],[a,.232,.214],[a*.5+b*.5,.156,.237],[b,.077+Math.abs(b)*.18,.227]],w,.023,[0x2c2e2c,0x424840]);
 // Fedora with a curved brim and a pinched, indented crown.
 const hat=new T.Group();head.add(hat);hat.position.set(0,.327,-.026);hat.rotation.z=-.075;
 surface(hat,(u,v)=>{const a=u*Math.PI*2,r=.265+v*.166;return [Math.sin(a)*r,.014+Math.pow(v,1.4)*(.024*Math.cos(a*2)-.025*Math.cos(a)),Math.cos(a)*r*.84];},64,8,coat).material.side=T.DoubleSide;
 const brimline=[];for(let i=0;i<=64;i++){let a=i/64*Math.PI*2;brimline.push([Math.sin(a)*.431,.014+.024*Math.cos(a*2)-.025*Math.cos(a),Math.cos(a)*.431*.84]);}line(hat,brimline,.009,fold);
 surface(hat,(u,v)=>{const a=u*Math.PI*2;const r=.293*(1-.20*v)*(1-.06*Math.cos(a*2)*Math.sin(v*Math.PI));return[Math.sin(a)*r,.014+v*.267,Math.cos(a)*r*.84];},64,16,coat);
 surface(hat,(u,v)=>{const a=u*Math.PI*2,r=.234*v;return[Math.sin(a)*r,.281-.046*(1-v*v)*Math.pow(Math.cos(a),2),Math.cos(a)*r*.84];},64,12,coat);
 surface(hat,(u,t)=>{const a=u*Math.PI*2,v=.085+t*.25,r=.293*(1-.20*v)*(1-.06*Math.cos(a*2)*Math.sin(v*Math.PI))+.002;return[Math.sin(a)*r,.014+v*.267,Math.cos(a)*r*.84];},64,8,mat(0x554737));
 const bag=new T.Group();bag.position.set(-.321,.85,.04);bag.rotation.z=-.08;body.add(bag);
 rounded(bag,.218,.264,.13,.025,mat(0x574b3b),[0,0,0]);rounded(bag,.225,.121,.15,.018,mat(0x66543f),[0,.085,.005]);
 rounded(bag,.033,.13,.018,.005,mat(0x40382d),[0,-.01,.083]);rounded(bag,.049,.05,.013,.005,gold,[0,-.001,.097]);rounded(bag,.03,.03,.018,.003,mat(0x574b3b),[0,.001,.104]);
 line(bag,[[-.09,.114,.079],[-.09,-.094,.079],[0,-.122,.079],[.09,-.094,.079],[.09,.114,.079]],.0025,mat(0xab9372));
 line(body,[[-.337,.97,.005],[-.278,1.34,.023],[-.23,1.42,.035],[-.21,1.35,-.10],[-.30,.96,-.05]],.013,mat(0x514334));
 root.userData.rig={body,head,legs,arms,bag,tails};
 if(ghost)root.traverse(o=>{o.layers.set(1);if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
 return root;
}
export function animateDetective(root,time,moving=0){const{body,head,legs,arms,bag}=root.userData.rig;const w=time*9.5,a=Math.min(1,moving);legs[0].rotation.x=Math.sin(w)*.40*a;legs[1].rotation.x=-Math.sin(w)*.40*a;for(const arm of arms){arm.shoulder.rotation.x=Math.sin(w+(arm.side<0?Math.PI:0))*.30*a;arm.elbow.rotation.x=-.15-Math.max(0,Math.sin(w+(arm.side<0?0:Math.PI)))*a*.12;}body.position.y=-.115+Math.abs(Math.sin(w))*.021*a+Math.sin(time*1.8)*.003*(1-a);body.rotation.z=Math.sin(w)*.012*a;head.rotation.y=Math.sin(time*.65)*.025*(1-a);bag.rotation.x=Math.sin(w)*.075*a;}
