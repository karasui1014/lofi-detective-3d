import * as THREE from 'three';

const cache=new Map();
export function material(color,roughness=.75,metalness=0){
  const key=`${color}/${roughness}/${metalness}`;
  if(!cache.has(key))cache.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));
  return cache.get(key);
}
export function mesh(parent,geometry,mat,x=0,y=0,z=0){
  const obj=new THREE.Mesh(geometry,mat);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;
}
export function box(parent,w,h,d,mat,x=0,y=0,z=0){return mesh(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
export function ball(parent,rx,ry,rz,mat,x=0,y=0,z=0){const m=mesh(parent,new THREE.SphereGeometry(1,16,12),mat,x,y,z);m.scale.set(rx,ry,rz);return m;}
export function cylinder(parent,top,bottom,height,mat,x=0,y=0,z=0,segments=20){return mesh(parent,new THREE.CylinderGeometry(top,bottom,height,segments),mat,x,y,z);}
export function tube(parent,points,radius,mat){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,radius,7,false),mat);}
function shapeMesh(parent,points,mat,z=0,depth=.025){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const m=mesh(parent,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false}),mat,0,0,z);return m;}

export {createDetective,animateDetective} from './detective.mjs';

export function createCat({shadow=false}={}){
  const g=new THREE.Group();g.name='Siam';
  const ball=(parent,rx,ry,rz,mat,x=0,y=0,z=0)=>{const part=mesh(parent,new THREE.SphereGeometry(1,32,24),mat,x,y,z);part.scale.set(rx,ry,rz);return part;};
  const soft=color=>new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,emissive:color,emissiveIntensity:.12});
  const fur=soft(0xeee0c7),points=soft(0x8b6a57),cream=soft(0xfff0da),pink=soft(0xdba69f);
  const dark=new THREE.MeshBasicMaterial({color:0x302d38}),iris=new THREE.MeshBasicMaterial({color:0x63bbc5}),shine=new THREE.MeshBasicMaterial({color:0xfffaf1});
  ball(g,.245,.265,.23,fur,0,.285,0);
  ball(g,.18,.21,.07,cream,0,.28,.195);
  for(const side of [-1,1]){
    ball(g,.125,.145,.145,fur,side*.18,.145,0);
    ball(g,.085,.14,.085,fur,side*.095,.17,.175);
    ball(g,.096,.052,.114,cream,side*.098,.055,.21);
  }
  const head=new THREE.Group();head.name='Siam round head';head.position.set(0,.65,.065);g.add(head);
  ball(head,.29,.235,.22,fur);
  const eyes=new THREE.Group();head.add(eyes);
  for(const side of [-1,1]){
    const outline=new THREE.Shape();outline.moveTo(-.085,0);outline.quadraticCurveTo(-.09,.05,-.025,.18);outline.quadraticCurveTo(0,.215,.026,.17);outline.lineTo(.09,0);outline.closePath();
    const ear=mesh(head,new THREE.ExtrudeGeometry(outline,{depth:.06,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:3,steps:1,curveSegments:10}),points,side*.188,.145,-.005);ear.rotation.z=side*-.23;
    const inside=ball(ear,.048,.073,.014,pink,0,.078,.08);inside.rotation.z=side*.08;
    // Separate soft eye patches leave a bright muzzle, not a dark facial mask.
    ball(head,.09,.09,.014,points,side*.115,.012,.198);
    ball(eyes,.069,.078,.016,dark,side*.115,.023,.210);
    ball(eyes,.055,.063,.011,iris,side*.115,.023,.221);
    ball(eyes,.031,.047,.006,dark,side*.111,.027,.231);
    ball(eyes,.017,.021,.005,shine,side*.115-.014,.055,.239);
    ball(eyes,.007,.009,.003,shine,side*.115+.018,.005,.239);
    ball(head,.09,.058,.035,cream,side*.065,-.09,.22);
    ball(head,.049,.026,.008,pink,side*.191,-.075,.202);
    tube(head,[[0,-.095,.26],[side*.025,-.116,.264],[side*.047,-.104,.26]],.004,points);
  }
  ball(head,.021,.014,.014,pink,0,-.078,.264);
  tube(g,[[.17,.10,-.13],[.31,.085,-.15],[.37,.078,.02],[.31,.069,.23],[.16,.066,.29]],.056,points);
  ball(g,.056,.056,.056,points,.16,.066,.29);
  cylinder(g,.153,.153,.032,soft(0x648c89),0,.456,.062,24);
  ball(g,.029,.033,.013,soft(0xdab979),0,.441,.222);
  g.userData.head=head;g.userData.eyes=eyes;
  g.traverse(o=>{if(o.isMesh){o.receiveShadow=false;if(shadow)o.material=material(0x111720,1);}});
  return g;
}

export function animateCat(cat,time){
  const {head,eyes}=cat.userData;if(!head||!eyes)return;
  head.rotation.z=Math.sin(time*.7)*.035;
  const phase=(time%4.8)/4.8,blink=Math.max(0,1-Math.abs(phase-.93)/.018);
  eyes.scale.y=1-blink*.93;
}

export function createCup(){
  const g=new THREE.Group(),ceramic=material(0xede5d4,.28),coffee=material(0x281b15,.18);
  cylinder(g,.20,.205,.025,ceramic,0,.015,0,32);
  const profile=[[.1,.03],[.125,.07],[.144,.255],[.151,.277],[.13,.279],[.124,.254],[.106,.07]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(g,new THREE.LatheGeometry(profile,32),ceramic);
  cylinder(g,.123,.123,.008,coffee,0,.235,0,28);
  const handle=mesh(g,new THREE.TorusGeometry(.091,.021,10,24,Math.PI*1.75),ceramic,.16,.175,0);handle.rotation.y=Math.PI/2;
  return g;
}
export function createRecord(){
  const g=new THREE.Group();box(g,.93,.15,.69,material(0x604630),0,.08,0);box(g,.97,.034,.73,material(0x8b6a46),0,.174,0);
  const vinyl=cylinder(g,.295,.295,.018,material(0x16191a,.28),-.07,.201,0,40);
  for(const radius of [.14,.18,.225,.275]){const groove=mesh(g,new THREE.TorusGeometry(radius,.0017,3,40),material(0x424444,.3),-.07,.212,0);groove.rotation.x=Math.PI/2;}
  cylinder(g,.091,.091,.007,material(0xcfa56c),-.07,.216,0,24);cylinder(g,.012,.012,.04,material(0xb8b1a0,.3,.7),-.07,.238,0,12);
  tube(g,[[.35,.21,-.22],[.35,.245,-.22],[.12,.246,.10]],.012,material(0xbbb5a5,.25,.8));
  box(g,.08,.024,.033,material(0x33393a),.11,.239,.12);
  const knob=cylinder(g,.023,.023,.027,material(0xb3a189,.35,.6),.37,.22,.24,14);g.userData.vinyl=vinyl;
  return g;
}
export function createClock(makeText){
  const g=new THREE.Group();const face=material(0xe3d6b9),rim=material(0x755337,.5);
  const ring=cylinder(g,.39,.39,.09,rim,0,0,0,48);ring.rotation.x=Math.PI/2;
  const dial=cylinder(g,.345,.345,.018,face,0,0,.057,48);dial.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2,tick=box(g,.014,.035,.009,material(0x4d4438),Math.sin(a)*.307,Math.cos(a)*.307,.071);tick.rotation.z=-a;}
  if(makeText){const numbers=mesh(g,new THREE.PlaneGeometry(.62,.62),new THREE.MeshBasicMaterial({map:makeText('clock'),transparent:true}),0,0,.081);numbers.castShadow=false;}
  box(g,.021,.225,.012,material(0x353330),0,.103,.087);box(g,.033,.158,.012,material(0x353330),0,.07,.101);ball(g,.027,.027,.015,material(0x7d5f3e),0,0,.113);
  return g;
}
