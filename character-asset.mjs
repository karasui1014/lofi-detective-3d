import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from './vendor/utils/SkeletonUtils.js';
import { replaceHead } from './tsukuyo-head.mjs';

function selectClip(clips, name, kind) {
  const matches = name
    ? clips.filter(clip => clip.name === name)
    : clips.filter(clip => new RegExp(`(^|[^a-z])${kind}([^a-z]|$)`, 'i').test(clip.name));
  if (matches.length !== 1 || !(matches[0].duration > 0)) {
    throw new Error(`Specify one valid ${kind} clip. Available: ${clips.map(c => c.name).join(', ')}`);
  }
  return matches[0];
}

// A stationary fallback uses the centre of the whole walk cycle, not its
// first (mid-stride) frame. Align quaternion signs before averaging rotations.
function neutralClip(source) {
  const clip = source.clone();
  clip.name = 'Idle';
  for (const track of clip.tracks) {
    const size = track.getValueSize();
    const interpolant = track.createInterpolant();
    const mean = new Array(size).fill(0);
    const reference = Array.from(interpolant.evaluate(0));
    for (let sample = 0; sample < 64; sample++) {
      const values = interpolant.evaluate(source.duration * sample / 64);
      const sign = track.ValueTypeName === 'quaternion' &&
        values.reduce((sum, value, index) => sum + value * reference[index], 0) < 0 ? -1 : 1;
      for (let i = 0; i < size; i++) mean[i] += values[i] * sign / 64;
    }
    if (track.ValueTypeName === 'quaternion') {
      const length = Math.hypot(...mean);
      for (let i = 0; i < size; i++) mean[i] /= length;
    }
    track.times = new Float32Array([0, source.duration]);
    track.values = new Float32Array([...mean, ...mean]);
  }
  return clip;
}

// World movement already handles collision. Keep only vertical root motion in
// an imported animation so the mesh cannot walk out of its collision position.
export function inPlaceClip(source, rootNames) {
  const clip = source.clone();
  for (const track of clip.tracks) {
    const binding = THREE.PropertyBinding.parseTrackName(track.name);
    const node = (binding.objectName === 'bones' ? binding.objectIndex : binding.nodeName) ?? '';
    if (binding.propertyName !== 'position' || !rootNames.has(node)) continue;
    if (track.getValueSize() !== 3 || track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline) {
      throw new Error(`Bake root-motion track to linear XYZ keyframes: ${track.name}`);
    }
    const x = track.values[0], z = track.values[2];
    for (let i = 0; i < track.values.length; i += 3) {
      track.values[i] = x;
      track.values[i + 2] = z;
    }
  }
  return clip;
}

function disposeResources(scenes) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  for (const scene of scenes) scene.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const material of node.material ? [].concat(node.material) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const resource of [...skeletons, ...geometries, ...materials, ...textures]) resource.dispose();
  const images = new Set([...textures].map(texture => texture.source?.data));
  for (const image of images) image?.close?.();
}

export async function loadCharacterAsset(url, options = {}) {
  // The head model downloads alongside the body instead of after it.
  const headLoad = options.refineDetective && options.headModel ? new GLTFLoader().loadAsync(options.headModel) : null;
  headLoad?.catch(() => {});
  const gltf = await new GLTFLoader().loadAsync(url);
  try {
    const longest = new Map();
    for (const clip of gltf.animations) {
      const prior = longest.get(clip.name);
      if (!prior || clip.duration > prior.duration) longest.set(clip.name, clip);
    }
    gltf.animations = [...longest.values()];
    // Swap the supplied head for the rebuilt one (face, hair, hat, glasses).
    if (options.refineDetective) {
      const headModel = headLoad ? (await headLoad).scene : null;
      replaceHead(gltf.scene, { headModel, stripOldHead: !options.oldHeadRemoved });
    }
    return createCharacterAsset(gltf, options);
  }
  catch (error) { disposeResources(gltf.scenes || [gltf.scene]); throw error; }
}

// This accepts a real, rigged, animated model. It does not manufacture a
// replacement character or call a still image a playable model.
export function createCharacterAsset(gltf, {
  height = 2.2, facingYaw = 0, idleClip, walkClip, rootMotionNodes = [], allowIdleFallback = false, groundFeet = false, receiveShadows = true,
  softenMaterials = false, walkBlend = .85, headScale = 1, walkSpeed = 0,
} = {}) {
  if (!gltf.scene?.isObject3D || !Number.isFinite(height) || height <= 0 || !Number.isFinite(facingYaw) ||
      !Number.isFinite(walkBlend) || walkBlend < 0 || walkBlend > 1 || !Number.isFinite(headScale) || headScale < .8 || headScale > 1.25) {
    throw new Error('A finite model height, orientation and glTF scene are required.');
  }
  const clips = gltf.animations || [];
  const roots = new Set(rootMotionNodes);
  let skinCount = 0;
  gltf.scene.traverse(node => {
    if (node.isSkinnedMesh && node.skeleton?.bones.length) skinCount++;
    if (node === gltf.scene || (node.isBone && /^(mixamorig[:_]?)?(hips|hip|pelvis|root)$/i.test(node.name))) {
      roots.add(node.name); roots.add(node.uuid);
    }
    if (node.isBone && !node.parent?.isBone) {
      for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
        roots.add(ancestor.name); roots.add(ancestor.uuid);
        if (ancestor === gltf.scene) break;
      }
    }
  });
  if (!skinCount) throw new Error('The character needs a skinned skeleton before game integration.');
  const walk = inPlaceClip(selectClip(clips, walkClip, 'walk'), roots);
  let idle;
  try { idle = inPlaceClip(selectClip(clips, idleClip, 'idle'), roots); }
  catch (error) {
    if (idleClip || !allowIdleFallback) throw error;
    idle = neutralClip(walk);
  }
  const instances = new Set();
  let disposed = false;

  const asset = {
    clipNames: { idle: idle.name, walk: walk.name },
    create({ ghost = false } = {}) {
      if (disposed) throw new Error('This character asset has been disposed.');
      const model = cloneSkeleton(gltf.scene);
      const uuidMap = new Map();
      const mapNodes = (source, copy) => {
        uuidMap.set(source.uuid, copy.uuid);
        source.children.forEach((child, index) => mapNodes(child, copy.children[index]));
      };
      mapNodes(gltf.scene, model);
      const rebind = clip => {
        const result = clip.clone();
        for (const track of result.tracks) {
          const binding = THREE.PropertyBinding.parseTrackName(track.name);
          const uuid = uuidMap.get(binding.nodeName);
          if (uuid) track.name = track.name.replace(binding.nodeName, uuid);
        }
        return result;
      };
      const orient = new THREE.Group(), normalized = new THREE.Group(), root = new THREE.Group();
      root.name = ghost ? 'Tsukuyo mirror visitor' : 'Akari Tsukuyo';
      orient.rotation.y = facingYaw;
      orient.add(model); normalized.add(orient); root.add(normalized);
      const mixer = new THREE.AnimationMixer(model);
      const idleAction = mixer.clipAction(rebind(idle)), walkAction = mixer.clipAction(rebind(walk));
      idleAction.setEffectiveWeight(1).play(); walkAction.setEffectiveWeight(0).play();
      mixer.update(0);
      const head=model.getObjectByName('Head');
      const baseHeadScale=head?.scale.clone();
      const applyProportions=()=>{if(head)head.scale.copy(baseHeadScale).multiplyScalar(headScale);};
      applyProportions();
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(orient, true);
      const size = bounds.getSize(new THREE.Vector3());
      if (bounds.isEmpty() || ![...bounds.min, ...bounds.max].every(Number.isFinite) || size.y <= 0) {
        mixer.stopAllAction(); mixer.uncacheRoot(model);
        model.traverse(node => node.skeleton?.dispose());
        throw new Error('The character has invalid bounds.');
      }
      const scale = height / size.y, center = bounds.getCenter(new THREE.Vector3());
      normalized.scale.setScalar(scale);
      normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      // Reduce lighting contrast on the supplied atlas without repainting it.
      // This is a candidate treatment for the dark lower face seen on phones,
      // not evidence that the imported normal map caused that appearance.
      const instanceMaterials = new Set(), materialCopies = new Map();
      const soften = material => {
        if (!softenMaterials || !material?.isMaterial || material.isMeshBasicMaterial || material.userData.headPart) return material;
        if (materialCopies.has(material)) return materialCopies.get(material);
        const copy = material.clone();
        if ('normalMap' in copy) copy.normalMap = null;
        if ('metalness' in copy) copy.metalness = 0;
        if ('roughness' in copy) copy.roughness = .9;
        if ((copy.isMeshStandardMaterial || copy.isMeshPhysicalMaterial) && copy.map) {
          copy.emissive.set(0xffffff);
          copy.emissiveMap = copy.map;
          copy.emissiveIntensity = .16;
        }
        copy.needsUpdate = true;
        materialCopies.set(material, copy); instanceMaterials.add(copy);
        return copy;
      };
      root.traverse(node => {
        node.layers.set(ghost ? 1 : 0);
        if (node.isMesh) {
          node.material = Array.isArray(node.material) ? node.material.map(soften) : soften(node.material);
          node.castShadow = !ghost && !node.userData.faceDetail;
          node.receiveShadow = !ghost && receiveShadows;
        }
        if (node.isSkinnedMesh) node.frustumCulled = false;
        // Lighting is owned by the corridor, even if the imported file has lights.
        if (node.isLight || node.isCamera) node.visible = false;
      });
      // Keep the lowest animated sole on the corridor floor. Sample a small
      // grid of bottom vertices once, rather than scanning the entire mesh
      // every frame on phones. The character's collision root never moves.
      const soles=[];
      if(groundFeet) model.traverse(node=>{
        if(!node.isSkinnedMesh || node.userData.faceDetail)return;
        const positions=node.geometry.attributes.position;
        let low=Infinity, high=-Infinity;
        for(let i=0;i<positions.count;i++){low=Math.min(low,positions.getY(i));high=Math.max(high,positions.getY(i));}
        const cell=(high-low)*.01, grid=new Map();
        for(let i=0;i<positions.count;i++){
          if(positions.getY(i)>low+(high-low)*.065)continue;
          const key=`${Math.floor(positions.getX(i)/cell)},${Math.floor(positions.getZ(i)/cell)}`;
          const prior=grid.get(key);
          if(prior===undefined||positions.getY(i)<positions.getY(prior))grid.set(key,i);
        }
        soles.push({node,vertices:[...grid.values()]});
      });
      const vertex=new THREE.Vector3(), toRoot=new THREE.Matrix4(), inverseRoot=new THREE.Matrix4();
      const ground=()=>{
        if(!soles.length)return;
        root.updateMatrixWorld(true); inverseRoot.copy(root.matrixWorld).invert();
        let bottom=Infinity;
        for(const {node,vertices} of soles){
          node.skeleton.update();toRoot.multiplyMatrices(inverseRoot,node.matrixWorld);
          for(const index of vertices)bottom=Math.min(bottom,node.getVertexPosition(index,vertex).applyMatrix4(toRoot).y);
        }
        if(Number.isFinite(bottom))normalized.position.y-=bottom;
        root.updateMatrixWorld(true);
      };
      ground();
      // The walk cycle, measured once on this instance: when each sole lands
      // (for footsteps) and how fast a planted foot travels back (so the cycle
      // can be played at the speed the character really moves: no sliding).
      const gait = (() => {
        const feet = ['LeftFoot', 'RightFoot'].map(name => model.getObjectByName(name));
        if (feet.some(foot => !foot)) return null;
        const count = 60, duration = walk.duration, samples = feet.map(() => []), p = new THREE.Vector3();
        idleAction.setEffectiveWeight(0); walkAction.setEffectiveWeight(1).setEffectiveTimeScale(1);
        for (let i = 0; i < count; i++) {
          walkAction.time = duration * i / count; mixer.update(0); root.updateMatrixWorld(true);
          feet.forEach((foot, k) => samples[k].push(foot.getWorldPosition(p).clone()));
        }
        walkAction.time = 0; idleAction.setEffectiveWeight(1); walkAction.setEffectiveWeight(0); mixer.update(0);
        const contacts = []; let travel = 0, planted = 0;
        samples.forEach((points, k) => {
          const heights = points.map(v => v.y), low = Math.min(...heights), high = Math.max(...heights), landing = low + (high - low) * .2;
          for (let i = 0; i < count; i++) {
            const before = heights[(i - 1 + count) % count], now = heights[i], next = (i + 1) % count;
            if (before >= landing && now < landing) contacts.push({ phase: i / count, side: k ? 1 : -1 });
            if (now < landing && heights[next] < landing) {
              travel += Math.hypot(points[next].x - points[i].x, points[next].z - points[i].z); planted += duration / count;
            }
          }
        });
        return { contacts: contacts.sort((a, b) => a.phase - b.phase), strideSpeed: planted ? travel / planted : 0 };
      })();
      let walkWeight = 0, alive = true;
      const actor = {
        root, model, mixer, facingYaw, gait,
        // Set by the game: called with -1 (left) / 1 (right) as a sole lands.
        onFootstep: null,
        update(dt, moving = 0) {
          if (!alive) return;
          const step = Math.min(.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
          const amount = Number.isFinite(moving) ? THREE.MathUtils.clamp(moving, 0, 1.6) : 0;
          const target = amount > .025 ? walkBlend : 0;
          walkWeight = THREE.MathUtils.lerp(walkWeight, target, 1 - Math.exp(-step * 14));
          idleAction.setEffectiveWeight(1 - walkWeight);
          // walkSpeed: world units per second at moving = 1. With the measured
          // stride the feet stay planted; otherwise the old proportional rate.
          const rate = walkSpeed > 0 && gait?.strideSpeed > 0 ? amount * walkSpeed / (gait.strideSpeed * Math.max(walkBlend, .5)) : amount;
          walkAction.setEffectiveWeight(walkWeight).setEffectiveTimeScale(THREE.MathUtils.clamp(rate, .08, 2.5));
          const before = walkAction.time;
          mixer.update(step);
          if (actor.onFootstep && gait && walkWeight > walkBlend * .45 && amount > .025) {
            const duration = walk.duration, from = before / duration, to = walkAction.time / duration;
            for (const { phase, side } of gait.contacts) {
              if (to >= from ? phase > from && phase <= to : phase > from || phase <= to) actor.onFootstep(side);
            }
          }
          applyProportions();
          ground();
        },
        dispose() {
          if (!alive) return;
          alive = false; mixer.stopAllAction(); mixer.uncacheRoot(model);
          const skeletons = new Set();
          model.traverse(node => { if (node.skeleton) skeletons.add(node.skeleton); });
          for (const skeleton of skeletons) skeleton.dispose();
          for (const material of instanceMaterials) material.dispose();
          root.removeFromParent(); instances.delete(actor);
        },
      };
      instances.add(actor);
      return actor;
    },
    dispose() {
      if (disposed) return;
      for (const actor of [...instances]) actor.dispose();
      disposeResources(gltf.scenes || [gltf.scene]); disposed = true;
    },
  };
  return asset;
}
