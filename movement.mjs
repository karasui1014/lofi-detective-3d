export const HALL_BOUNDS=Object.freeze({minX:-3.08,maxX:3.08,minZ:-13.7,maxZ:13.7});
export const SOLIDS=Object.freeze([
  {minX:2.05,maxX:3.5,minZ:-3.45,maxZ:-.15},
  {minX:-3.5,maxX:-2.62,minZ:9.0,maxZ:10.6},
  {minX:2.62,maxX:3.5,minZ:10.0,maxZ:11.6}
]);
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
export function followCameraPosition(player,yaw,pitch,distance){
  const x=Math.max(-3.15,Math.min(3.15,player.x+Math.sin(yaw)*distance));
  const z=Math.max(-14.35,Math.min(14.35,player.z+Math.cos(yaw)*distance));
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
export function moveWithCollision(position,delta,solids=SOLIDS,radius=.28){
  let {x,z}=position;
  const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/.12));
  const dx=delta.x/steps,dz=delta.z/steps,b=HALL_BOUNDS;
  for(let i=0;i<steps;i++){
    const nx=Math.max(b.minX,Math.min(b.maxX,x+dx));
    if(free(nx,z,solids,radius))x=nx;
    const nz=Math.max(b.minZ,Math.min(b.maxZ,z+dz));
    if(free(x,nz,solids,radius))z=nz;
  }
  return {x,z};
}
export function exitInReach(position){
  if(Math.abs(position.x)>1.5)return null;
  if(position.z < -11.7)return 'forward';
  if(position.z > 11.7)return 'back';
  return null;
}
