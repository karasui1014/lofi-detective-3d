// The corridor is an L: the long hall (A) runs from the entrance door at z=15
// to a blank wall at z=-15, and near that end it turns right into a shorter
// wing (B) along +x, which ends at the "forward" door at x=16.4.
export const HALL=Object.freeze({
  A:{minX:-3.6,maxX:3.6,minZ:-15,maxZ:15},
  B:{minX:3.6,maxX:16.4,minZ:-15,maxZ:-9.8},
});
// Where the character's centre may be (walls minus the body radius).
export const WALK_AREAS=Object.freeze([
  Object.freeze({minX:-3.08,maxX:3.08,minZ:-14.42,maxZ:13.7}),
  Object.freeze({minX:2.5,maxX:15.78,minZ:-14.42,maxZ:-10.38}),
]);
// Where the follow camera may be (a little closer to the walls).
const CAMERA_AREAS=[
  {minX:-3.15,maxX:3.15,minZ:-14.35,maxZ:14.35},
  {minX:2.5,maxX:15.9,minZ:-14.35,maxZ:-10.45},
];
export const SOLIDS=Object.freeze([
  {minX:2.05,maxX:3.5,minZ:-3.45,maxZ:-.15},
  {minX:-3.5,maxX:-2.62,minZ:9.0,maxZ:10.6},
  {minX:2.62,maxX:3.5,minZ:10.0,maxZ:11.6},
  // wing B: bench, umbrella stand, extinguisher
  {minX:6.6,maxX:8.4,minZ:-15,maxZ:-14.2},
  {minX:9.2,maxX:9.7,minZ:-15,maxZ:-14.25},
  {minX:5.85,maxX:6.15,minZ:-10.37,maxZ:-9.8},
]);
const inside=(x,z,area,m=0)=>x>=area.minX-m&&x<=area.maxX+m&&z>=area.minZ-m&&z<=area.maxZ+m;
export const inWalkArea=(x,z)=>WALK_AREAS.some(a=>inside(x,z,a,1e-9));
// A small thumb movement should not make the character creep or keep turning.
// Remap the remaining travel continuously, preserving full speed at the edge.
export function stickVector(x,y,deadZone=.14){
  const length=Math.hypot(x,y);
  if(length<=deadZone)return {x:0,y:0};
  const strength=(Math.min(1,length)-deadZone)/(1-deadZone);
  return {x:x/length*strength,y:y/length*strength};
}
// Keep the camera inside the hall, but lift it when a wall would push it
// into the actor. Component-wise clamping alone caused extreme face closeups.
// Around the corner the orbit point is clamped into each part of the L and
// the nearest clamp that the character can still be seen from is used.
function cameraGround(player,wanted){
  let best=null,bestDistance=Infinity;
  for(const area of CAMERA_AREAS){
    const x=Math.max(area.minX,Math.min(area.maxX,wanted.x)),z=Math.max(area.minZ,Math.min(area.maxZ,wanted.z));
    let clear=true;
    for(let i=1;i<=12&&clear;i++){const t=i/12,px=player.x+(x-player.x)*t,pz=player.z+(z-player.z)*t;clear=CAMERA_AREAS.some(a=>inside(px,pz,a,.02));}
    const d=Math.hypot(x-wanted.x,z-wanted.z);
    if(clear&&d<bestDistance){best={x,z};bestDistance=d;}
  }
  return best||{x:player.x,z:player.z};
}
export function followCameraPosition(player,yaw,pitch,distance){
  const {x,z}=cameraGround(player,{x:player.x+Math.sin(yaw)*distance,z:player.z+Math.cos(yaw)*distance});
  const horizontal=Math.hypot(x-player.x,z-player.z);
  const lift=Math.sqrt(Math.max(0,2.4**2-horizontal**2));
  const y=Math.min(4.1,Math.max(1.48,player.y+1.22+Math.max(Math.sin(pitch)*distance,lift)));
  return {x,y,z};
}
export function movementVector(x,forward,yaw,speed,dt){
  const len=Math.hypot(x,forward),factor=len>1?1/len:1;
  x*=factor;forward*=factor;
  return {x:(Math.cos(yaw)*x-Math.sin(yaw)*forward)*speed*dt,z:(-Math.sin(yaw)*x-Math.cos(yaw)*forward)*speed*dt};
}
// Use the camera that produced the visible frame, including wall constraints
// and orbit smoothing, rather than the camera's requested orbit angle.
export function movementFromCamera(x,forward,direction,speed,dt){
  const yaw=Math.atan2(-direction.x,-direction.z);
  return movementVector(x,forward,yaw,speed,dt);
}
export function turnTowardMovement(yaw,delta,dt){
  if(Math.hypot(delta.x,delta.z)<1e-8)return {yaw,delta};
  const target=Math.atan2(delta.x,delta.z);
  const difference=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw));
  const limit=Math.max(0,dt)*10;
  const turn=Math.max(-limit,Math.min(limit,difference));
  const nextYaw=yaw+turn;
  // Turn first on reversals so forward walking never becomes moonwalking.
  const alignment=Math.max(0,Math.cos(difference-turn));
  return {yaw:nextYaw,delta:{x:delta.x*alignment,z:delta.z*alignment}};
}
function free(x,z,solids,radius){return !solids.some(s=>x>s.minX-radius&&x<s.maxX+radius&&z>s.minZ-radius&&z<s.maxZ+radius);}
// Slide along a wall: move as far as the corridor allows on each axis.
function along(from,to,ok){
  if(ok(to))return to;
  let lo=0,hi=1;
  for(let i=0;i<8;i++){const mid=(lo+hi)/2;if(ok(from+(to-from)*mid))lo=mid;else hi=mid;}
  return from+(to-from)*lo;
}
export function moveWithCollision(position,delta,solids=SOLIDS,radius=.28){
  let {x,z}=position;
  const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/.12));
  const dx=delta.x/steps,dz=delta.z/steps;
  for(let i=0;i<steps;i++){
    const nx=along(x,x+dx,v=>inWalkArea(v,z));
    if(free(nx,z,solids,radius))x=nx;
    const nz=along(z,z+dz,v=>inWalkArea(x,v));
    if(free(x,nz,solids,radius))z=nz;
  }
  return {x,z};
}
export function exitInReach(position){
  if(position.z>11.7&&Math.abs(position.x)<1.5)return 'back';
  if(position.x>13.9&&Math.abs(position.z+12.4)<1.5)return 'forward';
  return null;
}
// Walking right up to a door answers with it.
export function exitReached(position){
  if(position.z>13.28&&Math.abs(position.x)<1.1)return 'back';
  if(position.x>15.38&&Math.abs(position.z+12.4)<1.1)return 'forward';
  return null;
}
