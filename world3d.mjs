import * as THREE from 'three';
import { Reflector } from './vendor/Reflector.js';
import { material,mesh,box,ball,cylinder,tube,createDetective,animateDetective,createCat,animateCat,createCup,createRecord,createClock } from './models3d.mjs';
import { movementVector,turnTowardMovement,moveWithCollision,exitInReach,followCameraPosition,HALL } from './movement.mjs';
import { buildCity,STREET_Y } from './city3d.mjs';

function textTexture(text,{width=768,height=192,bg='#9b815c',fg='#231f1b',size=68}={}){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
  if(bg){c.fillStyle=bg;c.fillRect(0,0,width,height);}
  c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`600 ${size}px "Yu Mincho", "Hiragino Mincho ProN", serif`;
  c.fillText(text,width/2,height/2,width*.93);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function clockTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#382f29';ctx.font='52px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=1;i<=12;i++){const a=i/12*Math.PI*2;ctx.fillText(String(i),256+Math.sin(a)*204,256-Math.cos(a)*204);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
// A small night-city painting; moons: how many moons hang over the roofs.
function cityPainting(moons=1){
  const c=document.createElement('canvas');c.width=512;c.height=384;const g=c.getContext('2d');
  const sky=g.createLinearGradient(0,0,0,384);sky.addColorStop(0,'#15243a');sky.addColorStop(1,'#3b4f66');g.fillStyle=sky;g.fillRect(0,0,512,384);
  g.fillStyle='#f3e3b5';for(const [x,y] of [[392,82],[132,96]].slice(0,moons)){g.beginPath();g.arc(x,y,34,0,Math.PI*2);g.fill();}
  const roofs=[[0,250,70],[64,210,58],[118,268,80],[196,190,62],[256,236,90],[344,204,70],[410,258,102]];
  g.fillStyle='#0d1624';for(const [x,top,w] of roofs)g.fillRect(x,top,w,384-top);
  g.fillStyle='#d8a960';for(const [x,top,w] of roofs)for(let yy=top+16;yy<370;yy+=26)for(let xx=x+10;xx<x+w-12;xx+=18)if((xx*7+yy*3)%5<3)g.fillRect(xx,yy,7,10);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function wallArt(group,w,h,texture,x,y,z,yaw=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yaw;group.add(g);box(g,w+.12,h+.12,.07,material(0x695033));const p=mesh(g,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}),0,0,.045);p.castShadow=false;return g;}

export class MidnightWorld {
  constructor(canvas){
    this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x182a38);this.scene.fog=new THREE.Fog(0x192937,17,42);
    this.camera=new THREE.PerspectiveCamera(55,1,.07,180);this.yaw=0;this.heldYaw=null;this.pitch=.25;this.distance=3.7;
    this.player=createDetective();this.scene.add(this.player);this.player.position.set(0,0,10.1);this.player.rotation.y=Math.PI;
    this.refs={};this.targets=[];this.inspection=null;this.raycaster=new THREE.Raycaster();this.elapsed=0;this.activeAnomaly=null;
    this.cameraTarget=new THREE.Vector3(0,1.15,10.1);this.camera.position.set(0,2.6,13.5);
    this.buildHall();this.buildObjects();this.reset();this.resize();
  }
  buildHall(){
    const s=this.scene,wall=material(0xb7aa90),darkwood=material(0x49392e),trim=material(0x755a3f),floor=material(0x6a4c36,.52),ceiling=material(0x3b3934),gold=material(0x8c7049,.45,.35);
    this.hemi=new THREE.HemisphereLight(0xaac6dc,0x453b30,1.15);s.add(this.hemi);
    const sun=new THREE.DirectionalLight(0xffd5a0,2.3);sun.position.set(-4,8,6);sun.castShadow=true;sun.shadow.mapSize.setScalar(matchMedia('(pointer: coarse)').matches?1024:2048);Object.assign(sun.shadow.camera,{left:-14,right:14,top:22,bottom:-22,near:.5,far:60});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.target.position.set(0,0,0);s.add(sun,sun.target);this.sun=sun;
    box(s,7.2,.12,30.5,floor,0,-.07,0);box(s,7.2,.17,30.5,ceiling,0,4.65,0);
    const planks=new THREE.InstancedMesh(new THREE.BoxGeometry(1.12,.035,.745),material(0x71543c,.56),6*40),matrix=new THREE.Matrix4(),col=new THREE.Color();let n=0;
    for(let x=0;x<6;x++)for(let z=0;z<40;z++){matrix.makeTranslation(-2.83+x*1.13,.005,-14.6+z*.75);planks.setMatrixAt(n,matrix);col.setHSL(.075+(x%3)*.004,.23,.20+((x*7+z*13)%9)*.009);planks.setColorAt(n++,col);}planks.receiveShadow=true;s.add(planks);
    // Runner with real thickness; border is additional geometry.
    box(s,1.58,.012,28.4,material(0x293c42),0,.035,0);for(const x of [-.73,.73])box(s,.025,.009,28.3,material(0x9b7d55),x,.045,0);
    // Wing B: the corridor turns right near the far end (HALL.B in movement.mjs).
    const B=HALL.B,bx=(B.minX+B.maxX)/2,bz=(B.minZ+B.maxZ)/2,bl=B.maxX-B.minX,bw=B.maxZ-B.minZ;
    box(s,bl,.12,bw,floor,bx,-.07,bz);box(s,bl,.17,bw,ceiling,bx,4.65,bz);
    const planksB=new THREE.InstancedMesh(new THREE.BoxGeometry(.745,.035,1.12),material(0x71543c,.56),17*5);n=0;
    for(let i=0;i<17;i++)for(let k=0;k<5;k++){matrix.makeTranslation(B.minX+.375+i*.75,.005,B.minZ+.56+k*1.03);planksB.setMatrixAt(n,matrix);col.setHSL(.075+(k%3)*.004,.23,.20+((k*7+i*13)%9)*.009);planksB.setColorAt(n++,col);}planksB.receiveShadow=true;s.add(planksB);
    box(s,B.maxX-.6-.79,.012,1.58,material(0x293c42),(.79+B.maxX-.6)/2,.035,bz);for(const dz of [-.73,.73])box(s,B.maxX-.6-.79,.009,.025,material(0x9b7d55),(.79+B.maxX-.6)/2,.045,bz+dz);
    box(s,.22,4.7,15-B.maxZ,wall,3.6,2.32,(15+B.maxZ)/2);
    // Left wall has actual openings onto a small 3D city.
    box(s,.22,1.18,30.5,darkwood,-3.6,.58,0);box(s,.22,.59,30.5,wall,-3.6,4.365,0);
    const gaps=[[-15,-9.3],[-5.7,-1.8],[1.8,5.7],[9.3,15]];
    for(const [a,b] of gaps)box(s,.22,2.9,b-a,wall,-3.6,2.63,(a+b)/2);
    this.windowMaterials=[];this.windowLights=[];
    for(const z of [-7.5,0,7.5]){
      for(const edge of [z-1.8,z+1.8])box(s,.24,3.13,.105,trim,-3.43,2.66,edge);
      for(const y of [1.12,2.56,4.16])box(s,.24,.1,3.65,trim,-3.43,y,z);
      box(s,.24,3.06,.06,trim,-3.43,2.66,z);box(s,.43,.11,3.87,trim,-3.34,1.12,z);
      const glassMat=new THREE.MeshBasicMaterial({color:0x789eb7,transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false});this.windowMaterials.push(glassMat);
      const pane=mesh(s,new THREE.PlaneGeometry(3.5,2.94),glassMat,-3.52,2.65,z);pane.rotation.y=Math.PI/2;pane.castShadow=false;
      const light=new THREE.PointLight(0x85b5d5,7,8,2);light.position.set(-2.95,2.8,z);s.add(light);this.windowLights.push(light);
    }
    for(const side of [-1,1]){
      const z0=side<0?-15.25:B.maxZ,len=15.25-z0,zc=(15.25+z0)/2;
      box(s,.24,1.13,len,darkwood,side*3.47,.55,zc);
      for(const y of [.12,1.13,4.43])box(s,.29,.075,len,trim,side*3.43,y,zc);
      for(let z=-14;z<=14;z+=2)if(z>z0+.3)box(s,.265,1.00,.055,trim,side*3.44,.59,z);
    }
    for(const [face,sgn] of [[B.minZ+.13,1],[B.maxZ-.13,-1]]){
      box(s,bl,1.13,.24,darkwood,bx,.55,face);
      for(const y of [.12,1.13,4.43])box(s,bl,.075,.29,trim,bx,y,face+sgn*.04);
      for(let x=B.minX+1.4;x<B.maxX-.4;x+=2)box(s,.055,1.00,.265,trim,x,.59,face+sgn*.03);
    }
    box(s,bl,4.7,.22,wall,bx,2.32,B.maxZ);box(s,.2,4.7,bw,wall,B.maxX+.1,2.3,bz);
    for(const x of [B.minX+3.4,B.minX+7.4,B.minX+11.4])box(s,.16,.2,bw,darkwood,x,4.4,bz);
    this.lamps={};
    const wallLamp=(key,x,z,yaw,lx,lz)=>{
      const lamp=new THREE.Group();lamp.position.set(x,3.63,z);lamp.rotation.y=yaw;s.add(lamp);
      box(lamp,.22,.34,.1,trim);tube(lamp,[[0,-.07,.01],[0,-.07,.20],[0,.1,.23]],.02,gold);
      cylinder(lamp,.13,.21,.29,material(0xf2d7a4,.35),0,.2,.23,16);
      const bulb=ball(lamp,.095,.11,.095,new THREE.MeshBasicMaterial({color:0xffd193}),0,.11,.23);bulb.castShadow=false;
      const light=new THREE.PointLight(0xffc27b,16,8,2);light.position.set(lx,3.51,lz);s.add(light);
      this.lamps[key]={lamp,bulb,light};
    };
    for(const z of [-11,-4,4,11]){
      box(s,7.0,.2,.16,darkwood,0,4.4,z);
      if(z>B.maxZ)wallLamp(z,3.38,z,-Math.PI/2,3.05,z);
    }
    for(const x of [B.minX+4.4,B.minX+9.4])wallLamp('b'+x,x,B.minZ+.22,0,x,B.minZ+.55);
    box(s,7.2+bl,4.7,.2,wall,bl/2,2.3,-15);
    wallArt(s,1.5,.36,textTexture('この先　→',{size:80}),0,2.75,-14.86);
    for(const [x,z,yaw,label] of [[B.maxX-.16,bz,-Math.PI/2,'この先へ'],[0,15-.16,Math.PI,'引き返す']]){
      if(z>0)box(s,7.2,4.7,.2,wall,0,2.3,15);
      const door=new THREE.Group();door.position.set(x,0,z);door.rotation.y=yaw;s.add(door);
      box(door,1.7,3.3,.17,darkwood,0,1.65,0);box(door,1.43,2.96,.05,material(0x776044),0,1.65,.11);
      for(const x of [-.9,.9])box(door,.13,3.5,.28,trim,x,1.75,.02);box(door,1.94,.15,.28,trim,0,3.43,.02);
      ball(door,.047,.047,.065,gold,.55,1.45,.18);
      wallArt(door,1.25,.32,textTexture(label,{size:78}),0,2.68,.15);
      const light=new THREE.PointLight(z<0?0xabc7d0:0xe5b277,10,7,2);light.position.set(z<0?x-1:0,3,z<0?z:z-1);s.add(light);
    }
    // The city outside the windows (city3d.mjs), and rain falling to the street.
    this.city=buildCity(s,this.renderer);
    const rainData=new Float32Array(900*6);for(let i=0;i<900;i++){const x=-3.9-Math.random()*12.5,y=STREET_Y+Math.random()*(14-STREET_Y),z=(Math.random()-.5)*40;rainData.set([x,y,z,x-.03,y+.45,z],i*6);}
    const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainData,3));this.rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0x7fa8be,transparent:true,opacity:.32}));s.add(this.rain);
    // Pots at the entrance give the player an immediate depth cue.
    this.pots=[];
    for(const [x,z] of [[-3,9.8],[3,10.8]]){const pot=new THREE.Group();pot.position.set(x,0,z);s.add(pot);this.pots.push(pot);cylinder(pot,.25,.19,.45,material(0x564d40),0,.23,0,16);for(let i=0;i<6;i++){const a=i*Math.PI/3;const leaf=ball(pot,.11,.47,.035,material(0x3d5146),Math.sin(a)*.17,.69,Math.cos(a)*.17);leaf.rotation.z=Math.sin(a)*.45;leaf.rotation.y=a;}}
  }
  register(id,name,object,position,look){
    object.traverse(o=>{o.userData.inspectTarget=id;});
    this.targets.push({id,name,object,position:new THREE.Vector3(...position),look:new THREE.Vector3(...look)});this.refs[id]=object;
  }
  buildObjects(){
    const s=this.scene;
    const cat=createCat();cat.position.set(-2.48,0,7.25);cat.rotation.y=.45;s.add(cat);
    this.register('cat','シャム',cat,[-2.4,.45,7.2],[-.65,1.1,9.25]);
    this.extraCat=createCat();this.extraCat.position.set(-1.43,0,7.25);this.extraCat.rotation.y=-.25;this.extraCat.visible=false;s.add(this.extraCat);this.extraCat.traverse(o=>o.userData.inspectTarget='cat');
    const shadowGroup=new THREE.Group();const shadowCat=createCat({shadow:true});shadowCat.rotation.x=-Math.PI/2;shadowGroup.add(shadowCat);shadowGroup.scale.set(1.3,.025,1.3);shadowGroup.position.set(-1.35,.02,8.0);shadowGroup.rotation.y=-.7;shadowGroup.visible=false;this.extraShadow=shadowGroup;s.add(shadowGroup);shadowGroup.traverse(o=>{o.userData.inspectTarget='cat';if(o.isMesh)o.castShadow=false;});
    const door=new THREE.Group();door.position.set(3.40,0,7);door.rotation.y=-Math.PI/2;s.add(door);
    box(door,1.7,3.22,.11,material(0x705238),0,1.61,0);for(const y of [.6,1.65,2.55])box(door,1.4,.68,.055,material(0x634831),0,y,.075);
    for(const x of [-.92,.92])box(door,.14,3.4,.2,material(0x98754d),x,1.7,.05);box(door,1.98,.13,.2,material(0x98754d),0,3.36,.05);
    ball(door,.046,.046,.058,material(0xc5a263,.3,.7),.62,1.35,.15);
    this.signMaterial=new THREE.MeshBasicMaterial({map:textTexture('月悠探偵事務所')});
    const sign=mesh(door,new THREE.PlaneGeometry(1.31,.30),this.signMaterial,0,2.05,.13);sign.castShadow=false;
    this.register('door','探偵事務所',door,[3.3,2.03,7],[1.2,2.13,7]);
    const loader=new THREE.TextureLoader();const reference=loader.load('assets/character-reference.png');reference.colorSpace=THREE.SRGBColorSpace;
    // A rectangular paper poster uses the supplied reference directly; no alpha extraction.
    reference.repeat.set(300/2048,620/1143);reference.offset.set(497/2048,(1143-80-620)/1143);
    const portrait=wallArt(s,.98,1.58,reference,3.40,2.6,2.7,-Math.PI/2);
    this.register('portrait','探偵のポスター',portrait,[3.32,2.6,2.7],[1.35,2.65,2.7]);
    const table=new THREE.Group();table.position.set(2.88,0,-1.8);s.add(table);
    box(table,.96,.14,3.0,material(0x75533a),0,1.0,0);box(table,.88,.28,2.86,material(0x59432f),0,.79,0);
    for(const x of [-.35,.35])for(const z of [-1.31,1.31])box(table,.09,.82,.09,material(0x4b3829),x,.42,z);
    for(const z of [-.71,.71])ball(table,.033,.033,.026,material(0xa98a50,.35,.5),-.46,.8,z);
    const record=createRecord();record.position.set(2.83,1.1,-2.47);record.rotation.y=Math.PI/2;s.add(record);
    this.register('record','レコードプレイヤー',record,[2.8,1.27,-2.47],[1.22,2.25,-1.70]);
    const cup=createCup();cup.position.set(2.72,1.1,-.84);s.add(cup);
    this.register('cup','コーヒーカップ',cup,[2.72,1.35,-.84],[1.4,1.83,-.04]);
    const clock=createClock(clockTexture);clock.position.set(3.37,2.99,-1.85);clock.rotation.y=-Math.PI/2;s.add(clock);
    this.register('clock','壁の時計',clock,[3.36,2.99,-1.85],[1.60,3.0,-1.85]);
    const mirrorFrame=new THREE.Group();mirrorFrame.position.set(3.39,2.5,-8.0);mirrorFrame.rotation.y=-Math.PI/2;s.add(mirrorFrame);
    for(const x of [-.73,.73])box(mirrorFrame,.09,2.45,.12,material(0x9d7e4d,.35,.55),x,0,0);
    for(const y of [-1.225,1.225])box(mirrorFrame,1.55,.1,.12,material(0x9d7e4d,.35,.55),0,y,0);
    const reflector=new Reflector(new THREE.PlaneGeometry(1.36,2.33),{color:0x84999d,textureWidth:512,textureHeight:512,clipBias:.003,multisample:0});mirrorFrame.add(reflector);reflector.position.z=.045;
    reflector.getReflectionCamera(this.camera).layers.enable(1);this.mirror=reflector;
    this.register('mirror','廊下の鏡',mirrorFrame,[3.35,2.48,-8.0],[.7,2.25,-7.85]);
    this.ghost=createDetective({ghost:true});this.ghost.position.set(1.6,0,-8.35);this.ghost.rotation.y=Math.PI/2;this.ghost.visible=false;s.add(this.ghost);
    const windowTarget=new THREE.Group();s.add(windowTarget);
    this.register('window','雨の窓',windowTarget,[-3.3,2.45,0],[-.65,2.35,.5]);
    // Small things that can change quietly.
    const pots=new THREE.Group();s.add(pots);for(const pot of this.pots)pots.attach(pot);
    this.register('pots','入口の鉢植え',pots,[3,.6,10.8],[1.1,1.7,8.6]);
    const lamp=this.lamps[-4];this.register('lamp','壁のランプ',lamp.lamp,[3.38,3.55,-4],[1.2,2.7,-2.9]);
    // Wing B: bench, umbrella stand, notice board, extinguisher, painting.
    const wood=material(0x6b4c33),metal=material(0x3d3a36,.4,.6);
    const bench=new THREE.Group();bench.position.set(7.5,0,-14.48);s.add(bench);
    box(bench,1.7,.08,.5,wood,0,.46,0);box(bench,1.7,.42,.06,wood,0,.78,-.22);for(const x of [-.75,.75])for(const z of [-.2,.2])box(bench,.07,.44,.07,metal,x,.22,z);
    const stand=new THREE.Group();stand.position.set(9.45,0,-14.5);s.add(stand);
    cylinder(stand,.2,.18,.55,material(0x5a5249,.5,.3),0,.28,0,20);
    this.umbrellaMaterial=new THREE.MeshStandardMaterial({color:0x2c3e5c,roughness:.7});
    for(const [dx,lean,mat] of [[-.06,.12,this.umbrellaMaterial],[.07,-.1,material(0xb49a74,.7)]]){
      const u=new THREE.Group();u.position.set(dx,.1,0);u.rotation.z=lean;stand.add(u);
      cylinder(u,.012,.012,1.0,metal,0,.55,0,8);cylinder(u,.02,.075,.62,mat,0,.62,0,14);tube(u,[[0,1.02,0],[0,1.1,0],[.06,1.12,0]],.012,material(0x2b211b));
    }
    this.register('umbrella','傘立て',stand,[9.45,.75,-14.45],[8.5,1.75,-12.1]);
    const board=new THREE.Group();board.position.set(11,1.85,-10);board.rotation.y=Math.PI;s.add(board);
    box(board,1.36,.96,.05,material(0x5d4430),0,0,0);box(board,1.26,.86,.04,material(0xa6835a,.9),0,0,.02);
    const note=(x,y,rot,col)=>{const g=new THREE.Group();g.position.set(x,y,.045);g.rotation.z=rot;board.add(g);box(g,.26,.33,.006,material(col,.9));ball(g,.018,.018,.012,material(0xb3342c,.4),0,.13,.008);return g;};
    note(-.4,.14,.05,0xefe6d2);note(-.02,-.1,-.04,0xe9e2c8);note(.38,.16,.03,0xf1ead8);
    this.extraNote=note(.3,-.22,-.08,0xe8d9b0);this.extraNote.visible=false;
    this.register('notice','掲示板',board,[11,1.85,-10.05],[11,1.95,-12.5]);
    const extinguisher=new THREE.Group();extinguisher.position.set(6,0,-10.22);s.add(extinguisher);
    cylinder(extinguisher,.11,.11,.56,material(0xb3261e,.45,.1),0,.3,0,18);ball(extinguisher,.11,.06,.11,material(0xb3261e,.45,.1),0,.58,0);
    box(extinguisher,.05,.09,.05,metal,0,.66,0);tube(extinguisher,[[0,.68,0],[0,.7,-.08],[0,.45,-.14]],.012,material(0x1b1b1b));
    this.register('extinguisher','消火器',extinguisher,[6,.45,-10.3],[6.4,1.35,-12.4]);
    this.paintingTextures=[cityPainting(1),cityPainting(2)];
    const painting=wallArt(s,1.5,1.12,this.paintingTextures[0],13,2.45,-14.86);
    this.paintingMaterial=painting.children.find(c=>c.material?.map===this.paintingTextures[0]).material;
    this.register('painting','街の絵',painting,[13,2.45,-14.8],[13,2.4,-11.9]);
  }
  reset(){this.player.position.set(0,0,10.1);this.player.rotation.set(0,Math.PI,0);this.yaw=0;this.heldYaw=null;this.pitch=.25;this.inspection=null;this.player.visible=true;this.camera.position.set(0,2.4,13.55);this.cameraTarget.set(0,1.17,10.1);}
  async loadCharacter(url,options={}){
    const request=(this.characterRequest||0)+1;this.characterRequest=request;
    const {loadCharacterAsset}=await import('./character-asset.mjs');
    const asset=await loadCharacterAsset(url,options);
    if(request!==this.characterRequest){asset.dispose();return false;}
    try{this.replaceCharacter(asset);return true;}catch(error){asset.dispose();throw error;}
  }
  replaceCharacter(asset){
    let player,ghost;
    try{player=asset.create();ghost=asset.create({ghost:true});}
    catch(error){player?.dispose();ghost?.dispose();throw error;}
    // Prepare both instances before changing the scene; a failed import leaves
    // the previous actors and all investigation state intact.
    const oldPlayer=this.player,oldGhost=this.ghost,previous=this.characterActors;
    for(const [next,old] of [[player.root,oldPlayer],[ghost.root,oldGhost]]){
      next.position.copy(old.position);
      // Quaternion -> XYZ Euler can represent yaw PI as (PI,0,PI).
      // Later editing just Euler.y then reverses the visible facing direction.
      const forward=new THREE.Vector3(0,0,1).applyQuaternion(old.quaternion);
      next.rotation.set(0,Math.atan2(forward.x,forward.z),0);next.visible=old.visible;
    }
    this.scene.add(player.root,ghost.root);this.player=player.root;this.ghost=ghost.root;
    this.characterActors={asset,player,ghost};
    oldPlayer.removeFromParent();oldGhost.removeFromParent();
    if(previous){
      if(previous.asset===asset){previous.player.dispose();previous.ghost.dispose();}
      else previous.asset.dispose();
    }else{
      const geometries=new Set();for(const old of [oldPlayer,oldGhost])old.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
      for(const geometry of geometries)geometry.dispose();
    }
  }
  applyAnomaly(id){
    this.activeAnomaly=id;this.refs.cat.visible=id!=='cat_missing';this.extraCat.visible=id==='cat_double';this.extraShadow.visible=id==='cat_shadow';
    this.refs.clock.visible=id!=='clock_missing';this.refs.clock.rotation.z=id==='clock_upside'?Math.PI:0;
    const hands=this.refs.clock.userData.hands;if(hands){hands.minute.rotation.z=id==='clock_time'?-Math.PI*4/3:0;hands.hour.rotation.z=id==='clock_time'?-Math.PI*11/18:0;}
    this.refs.portrait.rotation.z=id==='portrait_upside'?Math.PI:id==='portrait_tilted'?.21:0;
    this.pots[1].visible=id!=='pot_missing';
    const lamp=this.lamps[-4];lamp.bulb.material.color.set(id==='lamp_out'?0x2e2a24:0xffd193);lamp.light.intensity=id==='lamp_out'?0:16;
    this.umbrellaMaterial.color.set(id==='umbrella_red'?0xa3262a:0x2c3e5c);
    this.extraNote.visible=id==='notice_extra';
    this.refs.extinguisher.visible=id!=='extinguisher_missing';
    this.paintingMaterial.map=this.paintingTextures[id==='painting_moon'?1:0];this.paintingMaterial.needsUpdate=true;
    this.refs.cup.scale.setScalar(id==='cup_giant'?1.95:1);this.refs.cup.position.y=id==='cup_floating'?1.78:1.1;
    this.refs.record.position.y=id==='record_floating'?1.91:1.1;
    for(const mat of this.windowMaterials){mat.color.set(id==='window_red'?0xff0c14:0x789eb7);mat.opacity=id==='window_red'?.62:.14;}
    for(const light of this.windowLights)light.color.set(id==='window_red'?0xff2337:0x85b5d5);
    const old=this.signMaterial.map;this.signMaterial.map=textTexture(id==='sign_changed'?'月悠探偵失踪所':'月悠探偵事務所');this.signMaterial.needsUpdate=true;old?.dispose();
    this.ghost.visible=id==='mirror_visitor';
  }
  // Morning for the ending: low sun through the windows, lamps turned down,
  // no rain, the city at dawn.
  setMorning(on){
    const sun=this.sun;sun.position.set(...(on?[-12,6.5,2.5]:[-4,8,6]));sun.color.set(on?0xffcf9e:0xffd5a0);sun.intensity=on?3.4:2.3;
    Object.assign(sun.shadow.camera,on?{left:-24,right:24}:{left:-14,right:14});sun.shadow.camera.updateProjectionMatrix();
    this.hemi.color.set(on?0xd6e4ee:0xaac6dc);this.hemi.groundColor.set(on?0x75614c:0x453b30);this.hemi.intensity=on?1.35:1.15;
    for(const {light,bulb} of Object.values(this.lamps)){light.intensity=on?3:16;bulb.material.color.set(on?0xd9c9a8:0xffd193);}
    for(const light of this.windowLights){light.color.set(on?0xffd6a8:0x85b5d5);light.intensity=on?10:7;}
    this.scene.background.set(on?0xacbdc5:0x182a38);this.scene.fog.color.set(on?0xacbdc5:0x192937);
    this.renderer.toneMappingExposure=on?1.3:1.12;this.rain.visible=!on;this.city.setDawn(on);
  }
  // The ending: the detective and the cat at the middle window, filmed by a
  // slow camera move (see update()).
  beginEnding(){
    this.unfocus();this.setMorning(true);
    this.player.position.set(-1.85,0,.55);this.player.rotation.set(0,-Math.PI/2,0);
    const cat=this.refs.cat;this.catHome??={position:cat.position.clone(),yaw:cat.rotation.y};
    cat.visible=true;cat.position.set(-2.4,0,1.2);cat.rotation.y=-1.15;
    this.cinematic={t0:this.elapsed};
  }
  endEnding(){
    this.cinematic=null;this.setMorning(false);
    if(this.catHome){this.refs.cat.position.copy(this.catHome.position);this.refs.cat.rotation.y=this.catHome.yaw;}
  }
  // On a tall (portrait) screen keep roughly the landscape's side-to-side view,
  // so the character no longer fills the frame and hides the corridor.
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);const aspect=r.width/r.height;this.camera.aspect=aspect;
    this.camera.fov=aspect>=1?55:Math.min(78,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(46)/2)/aspect)));this.camera.updateProjectionMatrix();}
  orbit(dx,dy){if(this.inspection)return;this.yaw-=dx*.006;if(this.heldYaw!==null)this.heldYaw-=dx*.006;this.pitch=THREE.MathUtils.clamp(this.pitch+dy*.004,-.05,.68);}
  zoom(delta){if(!this.inspection)this.distance=THREE.MathUtils.clamp(this.distance+delta*.004,2.1,4.6);}
  focus(id){const target=this.targets.find(t=>t.id===id);if(!target)return false;this.inspection=target;this.player.visible=false;return true;}
  unfocus(){this.inspection=null;this.player.visible=true;}
  nearest(){
    let chosen=null,score=Infinity;const camForward=new THREE.Vector3();this.camera.getWorldDirection(camForward);
    for(const target of this.targets){const d=Math.hypot(this.player.position.x-target.position.x,this.player.position.z-target.position.z);const projected=target.position.clone().project(this.camera);
      if(d<3.75&&projected.z<1&&Math.abs(projected.x)<.93&&Math.abs(projected.y)<.91&&d<score){chosen=target;score=d;}}
    return chosen;
  }
  pick(clientX,clientY){const r=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);
    const intersections=this.raycaster.intersectObjects(this.scene.children,true);const hit=intersections.find(h=>h.object.userData.inspectTarget);
    if(!hit)return null;const t=this.targets.find(t=>t.id===hit.object.userData.inspectTarget);return t&&Math.hypot(this.player.position.x-t.position.x,this.player.position.z-t.position.z)<4?t:null;
  }
  update(dt,time,input,active){
    this.elapsed=time;let speed=0;
    if(active&&!this.inspection){
      const step=Math.min(dt,.05), direction=this.camera.getWorldDirection(new THREE.Vector3());
      // Controls take the visible camera's direction when the stick is pressed
      // and keep it while held (turning the view by swiping still turns them),
      // so the camera swinging round a corner by itself never bends the path.
      const held=Math.hypot(input.x,input.forward)>.05;
      if(!held)this.heldYaw=null;else if(this.heldYaw===null)this.heldYaw=Math.atan2(-direction.x,-direction.z);
      const requested=movementVector(input.x,input.forward,held?this.heldYaw:0,input.run?2.45:1.65,step);
      const steering=turnTowardMovement(this.player.rotation.y,requested,step);
      this.player.rotation.set(0,steering.yaw,0);
      const old=this.player.position.clone();const p=moveWithCollision(old,steering.delta);this.player.position.x=p.x;this.player.position.z=p.z;
      const dx=p.x-old.x,dz=p.z-old.z;speed=Math.min(1.6,Math.hypot(dx,dz)/(Math.max(dt,.001)*1.65));
      // Around the corner and in the wing the camera swings behind the walking
      // detective (along the corridor axis), unless the player is turning it.
      if(!input.dragging&&speed>.2&&p.z<-9.6){
        const target=Math.abs(dx)>Math.abs(dz)?(dx>0?-Math.PI/2:Math.PI/2):(dz<0?0:Math.PI);
        const diff=Math.atan2(Math.sin(target-this.yaw),Math.cos(target-this.yaw));
        const turn=THREE.MathUtils.clamp(diff*(1-Math.exp(-step*2.6)),-step*2.2,step*2.2);
        this.yaw+=turn;
      }
    }
    if(this.characterActors){this.characterActors.player.update(dt,speed);if(this.ghost.visible)this.characterActors.ghost.update(dt,0);}
    else{animateDetective(this.player,time,speed);if(this.ghost.visible)animateDetective(this.ghost,time,0);}
    animateCat(this.refs.cat,time);if(this.extraCat.visible)animateCat(this.extraCat,time+.8);
    const desiredTarget=this.inspection?this.inspection.position.clone():this.player.position.clone().add(new THREE.Vector3(0,1.22,0));
    if(this.inspection?.id==='cup'&&this.activeAnomaly==='cup_floating')desiredTarget.y+=.55;
    if(this.inspection?.id==='record'&&this.activeAnomaly==='record_floating')desiredTarget.y+=.5;
    let desiredCamera;
    if(this.cinematic){
      // from over the shoulder towards the window, easing round to the side
      const t=THREE.MathUtils.clamp((time-this.cinematic.t0)/16,0,1),e=t*t*(3-2*t);
      desiredCamera=new THREE.Vector3().lerpVectors(new THREE.Vector3(1.7,2.35,3.3),new THREE.Vector3(-.35,1.8,3.05),e);desiredCamera.y+=Math.sin(time*.45)*.04;
      desiredTarget.lerpVectors(new THREE.Vector3(-3.6,2.3,-.2),new THREE.Vector3(-2.7,1.55,.45),e);
    }
    else if(this.inspection)desiredCamera=this.inspection.look.clone();
    else{const p=followCameraPosition(this.player.position,this.yaw,this.pitch,this.distance);desiredCamera=new THREE.Vector3(p.x,p.y,p.z);}
    const smooth=1-Math.exp(-dt*10);this.camera.position.lerp(desiredCamera,smooth);this.cameraTarget.lerp(desiredTarget,smooth);this.camera.lookAt(this.cameraTarget);
    const rain=this.rain.geometry.attributes.position;for(let i=0;i<rain.count;i+=2){let y=rain.getY(i)-dt*11;if(y<STREET_Y)y+=14-STREET_Y;rain.setY(i,y);rain.setY(i+1,y+.45);}rain.needsUpdate=true;
    this.city.update(dt,time);
    this.renderer.render(this.scene,this.camera);
    return {exit:exitInReach(this.player.position),nearest:active&&!this.inspection?this.nearest():null};
  }
}
