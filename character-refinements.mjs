import * as THREE from 'three';

// Model-space repair for the supplied Little Detective, not a screen overlay.
// The lip inherits the face's skin weights and follows the original skeleton.
export function addDetectiveSmile(scene) {
  let source;
  scene.traverse(node => { if (!source && node.isSkinnedMesh) source = node; });
  if (!source) throw new Error('The smile requires the detective skin.');
  const surface = new THREE.Mesh(source.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  surface.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), points = [], influences = [];
  const indices = source.geometry.attributes.skinIndex, weights = source.geometry.attributes.skinWeight;
  for (let i = 0; i <= 32; i++) {
    const t = i / 32 * 2 - 1;
    const x = -.002 + t * .0115, y = 1.269 + .0032 * t * t;
    ray.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit) throw new Error('Smile placement missed the face.');
    points.push(hit.point.clone().add(new THREE.Vector3(0, 0, .001)));
    influences.push(hit.face.a);
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 32, .00065, 8, false);
  // Taper the corners so the little smile has no blunt ends.
  const gp=geometry.attributes.position, centre=new THREE.Vector3(), vertex=new THREE.Vector3();
  for(let i=0;i<gp.count;i++){
    const ring=Math.floor(i/9), t=ring/32;
    curve.getPointAt(t,centre);vertex.fromBufferAttribute(gp,i);
    const taper=.3+.7*Math.pow(Math.sin(Math.PI*t),.45);
    vertex.sub(centre).multiplyScalar(taper).add(centre);gp.setXYZ(i,...vertex);
  }
  geometry.computeVertexNormals();
  const si = [], sw = [];
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    const v = influences[Math.min(32, Math.floor(i / 9))];
    for (let j = 0; j < 4; j++) { si.push(indices.getComponent(v,j)); sw.push(weights.getComponent(v,j)); }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si,4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw,4));
  const mouth = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial({color:0x98614f,toneMapped:false}));
  mouth.name = 'Tsukuyo small smile';
  mouth.renderOrder = 4;
  mouth.position.copy(source.position); mouth.quaternion.copy(source.quaternion); mouth.scale.copy(source.scale);
  mouth.bind(source.skeleton, source.bindMatrix);
  source.parent.add(mouth);
  // A transparent, smoothly fading blush on the cheek surface. It is real
  // skinned geometry, so it stays on the cheeks through turns and walking.
  for(const side of [-1,1]){
    const positions=[], colors=[], skinIndices=[], skinWeights=[], triangles=[];
    const tint=new THREE.Color(0xec9b89), rings=8, segments=40;
    for(let ring=0;ring<=rings;ring++)for(let j=0;j<=segments;j++){
      const r=ring/rings,a=j/segments*Math.PI*2;
      const x=side*.065+Math.cos(a)*r*.018,y=1.278+Math.sin(a)*r*.008;
      ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));
      const hit=ray.intersectObject(surface,false)[0];
      if(!hit)throw new Error('Cheek placement missed the face.');
      positions.push(hit.point.x,hit.point.y,hit.point.z+.0008);
      colors.push(tint.r,tint.g,tint.b,.24*Math.pow(1-r*r,2));
      for(let k=0;k<4;k++){skinIndices.push(indices.getComponent(hit.face.a,k));skinWeights.push(weights.getComponent(hit.face.a,k));}
      if(ring<rings&&j<segments){const v=ring*(segments+1)+j;triangles.push(v,v+1,v+segments+1,v+1,v+segments+2,v+segments+1);}
    }
    const cheekGeometry=new THREE.BufferGeometry();
    cheekGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    cheekGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
    cheekGeometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));
    cheekGeometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));
    cheekGeometry.setIndex(triangles);cheekGeometry.computeVertexNormals();
    const cheek=new THREE.SkinnedMesh(cheekGeometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
    cheek.name=`Tsukuyo cheek ${side}`;cheek.userData.faceDetail=true;cheek.renderOrder=3;
    cheek.position.copy(source.position);cheek.quaternion.copy(source.quaternion);cheek.scale.copy(source.scale);
    cheek.bind(source.skeleton,source.bindMatrix);source.parent.add(cheek);
  }
  mouth.userData.faceDetail=true;
  surface.material.dispose();
}
