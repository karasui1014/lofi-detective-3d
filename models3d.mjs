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

export {createCat,animateCat} from './siamese-cat.mjs';

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
