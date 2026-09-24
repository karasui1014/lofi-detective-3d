import * as THREE from 'three';

// シャム — the detective's Siamese partner, sitting upright as on the character
// sheet: cream body with a darker back, dark brown mask, ears, socks and tail,
// almond blue eyes, a dark collar with a gold tag. The body is a smooth
// distance-field sculpture meshed with surface nets; the head is a separate
// shape with a painted mask so it can tilt, and the eyes are separate so they
// can blink (animateCat). Units match the corridor; origin on the floor,
// facing +Z.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const COLORS = {
  cream: new THREE.Color(0xe6d8c4), fawn: new THREE.Color(0xbba285), point: new THREE.Color(0x3a2a22),
  chest: new THREE.Color(0xf0e6d8), head: new THREE.Color(0xd8c6ae),
  earInner: 0xa89082, collar: 0x2a2b35, tag: 0xc9a24f, whisker: 0xefe8de, nose: 0x2a1d19,
};

// ------------------------------------------------------------ SDF helpers
function ellipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const qx = px / rx, qy = py / ry, qz = pz / rz;
  const k0 = Math.sqrt(px * px + py * py + pz * pz), k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
// Tapered capsule from a (radius ra) to b (radius rb).
function capsule(x, y, z, a, b, ra, rb) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const px = x - a[0], py = y - a[1], pz = z - a[2];
  const t = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1);
  const dx = px - bx * t, dy = py - by * t, dz = pz - bz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }

// Sitting body: haunches, belly, upright chest, neck, straight front legs
// and the four paws.
function bodySdf(x, y, z) {
  const ax = Math.abs(x);
  let d = ellipsoid(x, y, z, 0, .2, -.07, .135, .2, .185);                      // belly and hips
  d = smin(d, ellipsoid(ax, y, z, .095, .15, -.085, .095, .15, .16), .06);      // folded hind legs
  d = smin(d, ellipsoid(x, y, z, 0, .4, .02, .108, .2, .122), .08);            // chest
  d = smin(d, ellipsoid(x, y, z, 0, .55, .07, .075, .085, .08), .06);          // neck
  d = smin(d, capsule(ax, y, z, [.055, .42, .09], [.052, .05, .13], .038, .028), .035); // front legs
  d = smin(d, ellipsoid(ax, y, z, .054, .026, .16, .038, .026, .056), .025);   // front paws
  d = smin(d, ellipsoid(ax, y, z, .13, .026, .03, .042, .026, .068), .03);     // hind paws
  return Math.max(d, -y);                                                      // flat on the floor
}

// Surface nets: a smooth mesh of the zero level set of `sdf` inside `box`.
function surfaceNets(sdf, min, max, cell) {
  const nx = Math.ceil((max.x - min.x) / cell), ny = Math.ceil((max.y - min.y) / cell), nz = Math.ceil((max.z - min.z) / cell);
  const sx = nx + 1, sy = ny + 1, value = new Float32Array(sx * sy * (nz + 1));
  const at = (i, j, k) => i + sx * (j + sy * k);
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    value[at(i, j, k)] = sdf(min.x + i * cell, min.y + j * cell, min.z + k * cell);
  }
  const vertex = new Int32Array(nx * ny * nz).fill(-1), pos = [];
  const cellAt = (i, j, k) => i + nx * (j + ny * k);
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) { v[c] = value[at(i + corners[c][0], j + corners[c][1], k + corners[c][2])]; if (v[c] < 0) inside++; }
    if (inside === 0 || inside === 8) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]), ca = corners[a], cb = corners[b];
      px += ca[0] + (cb[0] - ca[0]) * t; py += ca[1] + (cb[1] - ca[1]) * t; pz += ca[2] + (cb[2] - ca[2]) * t; n++;
    }
    vertex[cellAt(i, j, k)] = pos.length / 3;
    pos.push(min.x + (i + px / n) * cell, min.y + (j + py / n) * cell, min.z + (k + pz / n) * cell);
  }
  const index = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c); else index.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = value[at(i, j, k)] < 0, b = value[at(i + 1, j, k)] < 0;
    if (a !== b) quad(vertex[cellAt(i, j - 1, k - 1)], vertex[cellAt(i, j, k - 1)], vertex[cellAt(i, j, k)], vertex[cellAt(i, j - 1, k)], b);
  }
  for (let k = 1; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
    const a = value[at(i, j, k)] < 0, b = value[at(i, j + 1, k)] < 0;
    if (a !== b) quad(vertex[cellAt(i - 1, j, k - 1)], vertex[cellAt(i - 1, j, k)], vertex[cellAt(i, j, k)], vertex[cellAt(i, j, k - 1)], b);
  }
  for (let k = 0; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
    const a = value[at(i, j, k)] < 0, b = value[at(i, j, k + 1)] < 0;
    if (a !== b) quad(vertex[cellAt(i - 1, j - 1, k)], vertex[cellAt(i, j - 1, k)], vertex[cellAt(i, j, k)], vertex[cellAt(i - 1, j, k)], b);
  }
  // Normals from the field, and triangles wound to face along them.
  const normals = new Float32Array(pos.length), e = cell * .5;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const n = V(sdf(x + e, y, z) - sdf(x - e, y, z), sdf(x, y + e, z) - sdf(x, y - e, z), sdf(x, y, z + e) - sdf(x, y, z - e)).normalize();
    normals.set([n.x, n.y, n.z], i);
  }
  const ab = V(), ac = V(), face = V();
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t] * 3, index[t + 1] * 3, index[t + 2] * 3];
    ab.set(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
    ac.set(pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]);
    face.crossVectors(ab, ac);
    if (face.x * normals[a] + face.y * normals[a + 1] + face.z * normals[a + 2] < 0) [index[t + 1], index[t + 2]] = [index[t + 2], index[t + 1]];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}

// Siamese colouring: cream, a fawn saddle on the back and haunches, a paler
// chest, and dark brown socks.
function colorBody(geometry) {
  const p = geometry.attributes.position, colors = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(x);
    c.copy(COLORS.cream);
    c.lerp(COLORS.fawn, .75 * smooth(0, -.2, z) * smooth(.05, .3, y) + .35 * smooth(.08, .2, ax) * smooth(.05, -.12, z));
    c.lerp(COLORS.chest, .6 * smooth(.05, .14, z) * smooth(.28, .45, y) * (1 - smooth(.04, .09, ax)));
    const frontSock = smooth(.26, .1, y) * smooth(.08, .12, z) * (1 - smooth(.09, .12, ax));
    const hindSock = smooth(.08, .03, y) * smooth(.09, .12, ax);
    c.lerp(COLORS.point, Math.max(frontSock, hindSock) * .92);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ------------------------------------------------------------------- head
// Head in its own space (origin at its centre): round skull, short muzzle,
// full cheeks.
function headSdf(x, y, z) {
  const ax = Math.abs(x);
  let d = ellipsoid(x, y, z, 0, .012, -.01, .098, .086, .092);
  d = smin(d, ellipsoid(ax, y, z, .048, -.026, .03, .058, .05, .06), .03);
  d = smin(d, ellipsoid(x, y, z, 0, -.034, .066, .042, .034, .042), .025);
  d = smin(d, ellipsoid(x, y, z, 0, -.064, .05, .03, .02, .03), .02);
  return d;
}
// Siamese mask: dark over the muzzle and round the eyes with a faint line up
// the forehead, fading into the fawn head. Coloured per vertex (no texture
// seam at the back of the head).
function colorHead(geometry) {
  const p = geometry.attributes.position, colors = new Float32Array(p.count * 3), c = new THREE.Color();
  const g = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const front = smooth(-.02, .05, z);
    const mask = Math.max(g(x, y, 0, -.022, .07, .07), g(x, y, -.044, .004, .05, .042), g(x, y, .044, .004, .05, .042), .8 * g(x, y, 0, .028, .03, .034));
    c.copy(COLORS.head).lerp(COLORS.cream, smooth(-.02, -.07, y) * .4).lerp(COLORS.point, front * smooth(.15, .7, mask) * .96);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
function paintEye(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d'), m = size / 2;
  c.fillStyle = '#1b130f'; c.fillRect(0, 0, size, size);
  const g = c.createRadialGradient(m * .92, m * 1.1, 0, m, m, m * .9);
  g.addColorStop(0, '#a9d8f5'); g.addColorStop(.45, '#4f9fd8'); g.addColorStop(1, '#1f5690');
  c.fillStyle = g; c.beginPath(); c.arc(m, m, m * .86, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#080a0e'; c.beginPath(); c.ellipse(m, m, m * .16, m * .56, 0, 0, Math.PI * 2); c.fill();
  const lid = c.createLinearGradient(0, 0, 0, m);
  lid.addColorStop(0, 'rgba(10,12,20,.55)'); lid.addColorStop(1, 'rgba(10,12,20,0)');
  c.fillStyle = lid; c.fillRect(0, 0, size, m);
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(m * .7, m * .66, m * .15, 0, Math.PI * 2); c.fill();
  c.globalAlpha = .7; c.beginPath(); c.arc(m * 1.3, m * 1.34, m * .07, 0, Math.PI * 2); c.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A sphere shrink-wrapped onto `sdf` (star-shaped around the origin).
function wrapSphere(sdf, widthSegments, heightSegments) {
  const g = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const p = g.attributes.position, n = g.attributes.normal, d = V(), q = V();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    let lo = .005, hi = .3;
    for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; if (sdf(d.x * mid, d.y * mid, d.z * mid) < 0) lo = mid; else hi = mid; }
    q.copy(d).multiplyScalar(lo);
    p.setXYZ(i, q.x, q.y, q.z);
    const e = .0006;
    const nx = sdf(q.x + e, q.y, q.z) - sdf(q.x - e, q.y, q.z), ny = sdf(q.x, q.y + e, q.z) - sdf(q.x, q.y - e, q.z), nz = sdf(q.x, q.y, q.z + e) - sdf(q.x, q.y, q.z - e);
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(i, nx / l, ny / l, nz / l);
  }
  return g;
}

// Shared geometry and textures for every cat instance (the corridor keeps up
// to three: the cat, its double and its stray shadow).
let shared = null;
function sharedParts() {
  if (shared) return shared;
  const body = surfaceNets(bodySdf, V(-.25, -.01, -.29), V(.25, .66, .25), .0105);
  colorBody(body);
  const head = wrapSphere(headSdf, 96, 72);
  colorHead(head);
  const tail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    V(0, .07, -.23), V(.15, .045, -.22), V(.235, .036, -.06), V(.2, .032, .1), V(.1, .03, .19), V(.02, .03, .21),
  ]), 64, .03, 12, false);
  { // taper toward the tip, dark over its whole length (darkest at the end)
    const p = tail.attributes.position, colors = new Float32Array(p.count * 3), c = new THREE.Color();
    const curve = tail.parameters.path, centre = V(), point = V();
    for (let i = 0; i < p.count; i++) {
      const t = Math.floor(i / 13) / 64;
      curve.getPointAt(t, centre); point.fromBufferAttribute(p, i).sub(centre).multiplyScalar(1 - .45 * t).add(centre);
      p.setXYZ(i, point.x, point.y, point.z);
      c.copy(COLORS.fawn).lerp(COLORS.point, smooth(0, .35, t) * .95);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    tail.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    tail.computeVertexNormals();
  }
  const ear = new THREE.ConeGeometry(.052, .11, 3, 1, true);
  ear.rotateY(Math.PI); // a flat face toward the front
  const earInner = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-.028, -.036), new THREE.Vector2(.028, -.036), new THREE.Vector2(0, .045)]));
  const eye = new THREE.SphereGeometry(1, 24, 16);
  { const p = eye.attributes.position, uv = eye.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, .5 + p.getX(i) / 2, .5 + p.getY(i) / 2); }
  const soft = (options) => new THREE.MeshStandardMaterial({ roughness: .95, metalness: 0, ...options });
  shared = {
    body, head, tail, ear, earInner, eye,
    furMaterial: soft({ vertexColors: true, emissive: 0x3a332c, emissiveIntensity: .35 }),
    faceMaterial: soft({ vertexColors: true, emissive: 0x3a332c, emissiveIntensity: .3 }),
    noseMaterial: soft({ color: COLORS.nose, roughness: .5 }),
    pointMaterial: soft({ color: COLORS.point, emissive: COLORS.point, emissiveIntensity: .2 }),
    earInnerMaterial: soft({ color: COLORS.earInner, emissive: COLORS.earInner, emissiveIntensity: .12, side: THREE.DoubleSide }),
    eyeMaterial: new THREE.MeshBasicMaterial({ map: paintEye() }),
    collarMaterial: soft({ color: COLORS.collar, roughness: .6 }),
    tagMaterial: new THREE.MeshStandardMaterial({ color: COLORS.tag, roughness: .3, metalness: .85, emissive: 0x3a2a10, emissiveIntensity: .5 }),
    whiskerMaterial: new THREE.MeshBasicMaterial({ color: COLORS.whisker, transparent: true, opacity: .75 }),
  };
  return shared;
}

export function createCat({ shadow = false } = {}) {
  const s = sharedParts(), g = new THREE.Group();
  g.name = 'Siam';
  const add = (parent, geometry, material, name) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.castShadow = true; parent.add(m); return m;
  };
  add(g, s.body, s.furMaterial, 'Siam body');
  add(g, s.tail, s.furMaterial, 'Siam tail');
  // collar and gold tag
  const collar = add(g, new THREE.TorusGeometry(.09, .009, 8, 44), s.collarMaterial, 'Siam collar');
  collar.position.set(0, .56, .066); collar.rotation.set(Math.PI / 2 + .35, 0, 0);
  const tag = add(g, new THREE.CylinderGeometry(.019, .019, .005, 20), s.tagMaterial, 'Siam tag');
  tag.position.set(0, .505, .158); tag.rotation.set(Math.PI / 2 - .25, 0, 0);

  const head = new THREE.Group();
  head.name = 'Siam head';
  head.position.set(0, .66, .12);
  head.rotation.x = .08;
  head.scale.setScalar(1.3);
  g.add(head);
  add(head, s.head, s.faceMaterial, 'Siam face');
  const nose = add(head, new THREE.SphereGeometry(1, 16, 12), s.noseMaterial, 'Siam nose');
  nose.scale.set(.012, .008, .007); nose.position.set(0, -.033, .104);
  for (const side of [-1, 1]) {
    const mouth = add(head, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, -.042, .1), V(side * .006, -.052, .098), V(side * .016, -.05, .093)]), 8, .0014, 4), s.noseMaterial, `Siam mouth ${side}`);
    mouth.castShadow = false;
  }
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.name = `Siam ear ${side}`;
    ear.position.set(side * .058, .09, -.014);
    ear.rotation.set(-.12, 0, side * -.4);
    ear.scale.setScalar(1.3);
    head.add(ear);
    add(ear, s.ear, s.pointMaterial, `Siam ear outer ${side}`).scale.set(1, 1, .55);
    // the paler inside lies on the cone's front face, which leans back
    const inner = add(ear, s.earInner, s.earInnerMaterial, `Siam ear inner ${side}`);
    inner.position.set(0, 0, .0095);
    inner.rotation.x = -.129;
    for (const k of [-1, 0, 1]) {
      const whisker = add(head, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        V(side * .03, -.045 + k * .006, .088), V(side * .085, -.04 + k * .012, .08), V(side * .13, -.045 + k * .022, .05),
      ]), 8, .0011, 4), s.whiskerMaterial, `Siam whisker ${side}${k}`);
      whisker.castShadow = false;
    }
  }
  // Eyes: almond shapes tilted up at the outer corners, set into the mask.
  const eyes = new THREE.Group();
  eyes.name = 'Siam eyes';
  eyes.position.set(0, .006, 0);
  head.add(eyes);
  for (const side of [-1, 1]) {
    const eye = add(eyes, s.eye, s.eyeMaterial, `Siam eye ${side}`);
    eye.scale.set(.0235, .016, .011);
    eye.position.set(side * .04, 0, .077);
    eye.rotation.set(0, side * .42, side * .22);
    eye.castShadow = false;
  }
  g.userData.head = head; g.userData.eyes = eyes;
  g.traverse(o => {
    if (!o.isMesh) return;
    o.receiveShadow = false;
    if (shadow) o.material = shadowMaterial();
  });
  return g;
}

let shadowMat = null;
function shadowMaterial() { return shadowMat ??= new THREE.MeshStandardMaterial({ color: 0x111720, roughness: 1, metalness: 0 }); }

export function animateCat(cat, time) {
  const { head, eyes } = cat.userData;
  if (!head || !eyes) return;
  head.rotation.z = Math.sin(time * .7) * .035;
  const phase = (time % 4.8) / 4.8, blink = Math.max(0, 1 - Math.abs(phase - .93) / .018);
  eyes.scale.y = 1 - blink * .93;
}
