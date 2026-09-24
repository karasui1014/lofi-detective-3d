import * as THREE from 'three';

// A complete replacement head for the supplied Meshy "Little Detective":
// face, bob hair with teal tips, fedora, round glasses, ears and neck.
// Built as real geometry in the model's bind-pose space (1.70 units tall,
// +Z forward, Head bone at y≈1.263) and parented to the Head bone, so it
// follows the existing walk animation. Proportions and colours are taken
// from the approved character sheet (assets/character-reference.png).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;

export const HEAD_JOINTS = ['Head', 'head_end', 'headfront'];

const COLORS = {
  skin: '#f5d0b7',
  hair: 0x2c2522, hairDeep: 0x171311, teal: 0x345956, tealTip: 0x436f69,
  hat: 0x9a7a5a, band: 0x4a382a,
  glasses: 0x4f3a2a,
};

// ---------------------------------------------------------------- head shape
// Signed-distance model: a round cranium, soft cheeks and a small chin.
const CRANIUM = { c: [0, 1.372, 0], r: [.160, .158, .172] };
const CHEEK = { c: [.068, 1.292, .078], r: [.088, .072, .082] };
const CHIN = { c: [0, 1.252, .092], r: [.060, .042, .050] };
const ORIGIN = V(0, 1.35, .01);

// Ellipsoid distance (approximate): [cx, cy, cz, 1/rx, 1/ry, 1/rz, rx].
// Flat arrays and Math.sqrt: this runs a few million times while loading.
const ellipsoidData = ({ c, r }, mirror = 1) => [c[0] * mirror, c[1], c[2], 1 / r[0], 1 / r[1], 1 / r[2], r[0]];
const SDF_PARTS = [ellipsoidData(CRANIUM), ellipsoidData(CHEEK), ellipsoidData(CHEEK, -1), ellipsoidData(CHIN)];
function ellipsoid(x, y, z, e) {
  const px = (x - e[0]) * e[3], py = (y - e[1]) * e[4], pz = (z - e[2]) * e[5];
  const qx = px * e[3], qy = py * e[4], qz = pz * e[5];
  const k0 = Math.sqrt(px * px + py * py + pz * pz), k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -e[6];
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }
function headSdf(x, y, z) {
  const [cranium, cheekL, cheekR, chin] = SDF_PARTS;
  const cheeks = smin(ellipsoid(x, y, z, cheekL), ellipsoid(x, y, z, cheekR), .03);
  return smin(smin(ellipsoid(x, y, z, cranium), cheeks, .05), ellipsoid(x, y, z, chin), .045);
}
function sdfNormal(p, target = V()) {
  const e = .0008;
  return target.set(
    headSdf(p.x + e, p.y, p.z) - headSdf(p.x - e, p.y, p.z),
    headSdf(p.x, p.y + e, p.z) - headSdf(p.x, p.y - e, p.z),
    headSdf(p.x, p.y, p.z + e) - headSdf(p.x, p.y, p.z - e),
  ).normalize();
}
// Distance from `origin` along `dir` to the head surface (the shape is star-shaped).
function surfaceDistance(dir, origin = ORIGIN) {
  let lo = .005, hi = .45;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (headSdf(origin.x + dir.x * mid, origin.y + dir.y * mid, origin.z + dir.z * mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
// Keep a point at least `gap` outside the skin.
const pushNormal = V();
function pushOut(p, gap) {
  for (let i = 0; i < 6; i++) {
    const d = headSdf(p.x, p.y, p.z);
    if (d >= gap) return p;
    p.addScaledVector(sdfNormal(p, pushNormal), gap - d);
  }
  return p;
}
const surfaceZ = (x, y) => {
  let lo = -.05, hi = .35;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (headSdf(x, y, mid) < 0) lo = mid; else hi = mid; }
  return lo;
};

// ------------------------------------------------------------- face texture
// Painted in model units: x ∈ [-.2,.2], y ∈ [1.14,1.54] fills the canvas.
const FACE_BOX = { x0: -.2, y0: 1.14, size: .4 };
export const FACE_LAYOUT = { eyeX: .077, eyeY: 1.316, eyeScale: .82, mouthY: 1.245, noseY: 1.279, browY: 1.366, cheekX: .08, cheekY: 1.274 };

function paintFace(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  const S = size / FACE_BOX.size;
  const X = x => (x - FACE_BOX.x0) * S, Y = y => (FACE_BOX.y0 + FACE_BOX.size - y) * S;
  const k = size / 1024; // stroke scale
  c.fillStyle = COLORS.skin; c.fillRect(0, 0, size, size);
  const L = FACE_LAYOUT;

  // Cheek blush with a few soft hatch strokes.
  for (const side of [-1, 1]) {
    c.save(); c.translate(X(side * L.cheekX), Y(L.cheekY)); c.scale(1, .5);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 96 * k);
    g.addColorStop(0, 'rgba(241,146,128,.50)'); g.addColorStop(.55, 'rgba(243,160,140,.26)'); g.addColorStop(1, 'rgba(245,170,150,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 96 * k, 0, Math.PI * 2); c.fill(); c.restore();
    c.strokeStyle = 'rgba(222,120,108,.38)'; c.lineWidth = 3.2 * k; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const bx = X(side * L.cheekX) + i * 20 * k, by = Y(L.cheekY);
      c.beginPath(); c.moveTo(bx + 8 * k, by - 12 * k); c.lineTo(bx - 8 * k, by + 12 * k); c.stroke();
    }
  }

  // Eyebrows: short, thin, soft brown.
  c.strokeStyle = '#7b5646'; c.lineCap = 'round';
  for (const side of [-1, 1]) {
    const a = X(side * .045), b = X(side * .108), m = X(side * .078), y = Y(L.browY);
    c.lineWidth = 6 * k;
    c.beginPath(); c.moveTo(a, y + 6 * k); c.quadraticCurveTo(m, y - 12 * k, b, y + 8 * k); c.stroke();
  }

  // Eyes.
  for (const side of [-1, 1]) {
    const e = k * L.eyeScale; // eye drawing scale
    const cx = X(side * L.eyeX), cy = Y(L.eyeY);
    const inner = cx - side * 102 * e, outer = cx + side * 108 * e;
    const upper = () => { c.moveTo(inner, cy - 8 * e); c.bezierCurveTo(inner + (cx - inner) * .35, cy - 104 * e, outer - (outer - cx) * .5, cy - 112 * e, outer, cy - 42 * e); };
    const lower = () => { c.bezierCurveTo(outer - (outer - cx) * .15, cy + 40 * e, cx + (outer - cx) * .45, cy + 104 * e, cx, cy + 102 * e); c.bezierCurveTo(cx - (cx - inner) * .55, cy + 100 * e, inner, cy + 40 * e, inner, cy - 8 * e); };
    c.save();
    c.beginPath(); upper(); lower(); c.closePath(); c.clip();
    // eye white with a lid shadow
    const w = c.createLinearGradient(0, cy - 110 * e, 0, cy + 100 * e);
    w.addColorStop(0, '#a99ea3'); w.addColorStop(.24, '#f4eeec'); w.addColorStop(1, '#fffaf6');
    c.fillStyle = w; c.fillRect(cx - 160 * e, cy - 140 * e, 320 * e, 280 * e);
    // iris
    const irx = 78 * e, iry = 98 * e, icx = cx + side * 2 * e, icy = cy + 6 * e;
    const ig = c.createLinearGradient(0, icy - iry, 0, icy + iry);
    ig.addColorStop(0, '#132f38'); ig.addColorStop(.38, '#24606a'); ig.addColorStop(.72, '#3f8c86'); ig.addColorStop(1, '#a7d5b6');
    c.fillStyle = ig; c.beginPath(); c.ellipse(icx, icy, irx, iry, 0, 0, Math.PI * 2); c.fill();
    // soft radial fibres in the lower iris
    c.strokeStyle = 'rgba(160,214,190,.28)'; c.lineWidth = 3 * e;
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (.12 + .76 * i / 13);
      c.beginPath(); c.moveTo(icx + Math.cos(a) * irx * .38, icy + Math.sin(a) * iry * .38);
      c.lineTo(icx + Math.cos(a) * irx * .9, icy + Math.sin(a) * iry * .9); c.stroke();
    }
    c.strokeStyle = '#0f252d'; c.lineWidth = 6 * e; c.beginPath(); c.ellipse(icx, icy, irx - 2 * e, iry - 2 * e, 0, 0, Math.PI * 2); c.stroke();
    // pupil
    c.fillStyle = '#0a171d'; c.beginPath(); c.ellipse(icx, icy - 6 * e, 25 * e, 44 * e, 0, 0, Math.PI * 2); c.fill();
    // upper-lid shadow over the iris
    const sh = c.createLinearGradient(0, icy - iry, 0, icy - iry * .1);
    sh.addColorStop(0, 'rgba(8,20,26,.62)'); sh.addColorStop(1, 'rgba(8,20,26,0)');
    c.fillStyle = sh; c.fillRect(icx - irx, icy - iry, irx * 2, iry);
    // highlights (same light direction for both eyes)
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(icx - 28 * e, icy - 44 * e, 21 * e, 19 * e, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .9; c.beginPath(); c.ellipse(icx + 30 * e, icy + 42 * e, 9 * e, 8 * e, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .55; c.beginPath(); c.ellipse(icx - 6 * e, icy + 24 * e, 5 * e, 5 * e, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    c.restore();
    // upper lash line: a thick crescent with an outer flick
    c.fillStyle = '#2a1c18';
    c.beginPath();
    c.moveTo(inner - side * 4 * e, cy - 2 * e);
    c.bezierCurveTo(inner + (cx - inner) * .3, cy - 124 * e, outer - (outer - cx) * .45, cy - 136 * e, outer + side * 30 * e, cy - 70 * e);
    c.lineTo(outer + side * 8 * e, cy - 34 * e);
    c.bezierCurveTo(outer - (outer - cx) * .5, cy - 100 * e, inner + (cx - inner) * .35, cy - 92 * e, inner + side * 6 * e, cy - 4 * e);
    c.closePath(); c.fill();
    // double-lid crease
    c.strokeStyle = 'rgba(170,112,94,.55)'; c.lineWidth = 3.5 * e;
    c.beginPath(); c.moveTo(inner + (cx - inner) * .35, cy - 132 * e); c.quadraticCurveTo(cx + (outer - cx) * .2, cy - 152 * e, outer - side * 2 * e, cy - 104 * e); c.stroke();
    // lower lashes: a light touch on the outer half
    c.strokeStyle = 'rgba(96,62,52,.7)'; c.lineWidth = 3.5 * e;
    c.beginPath(); c.moveTo(cx + side * 20 * e, cy + 101 * e); c.quadraticCurveTo(outer - (outer - cx) * .15, cy + 78 * e, outer - side * 4 * e, cy + 30 * e); c.stroke();
  }

  // Nose: a tiny warm shadow dot.
  c.fillStyle = 'rgba(214,140,118,.55)';
  c.beginPath(); c.ellipse(X(0), Y(L.noseY), 6 * k, 4 * k, 0, 0, Math.PI * 2); c.fill();
  // Mouth: a small, gentle smile.
  c.strokeStyle = '#a95a4c'; c.lineWidth = 5 * k; c.lineCap = 'round';
  c.beginPath(); c.moveTo(X(-.0155), Y(L.mouthY + .0024)); c.quadraticCurveTo(X(0), Y(L.mouthY - .0066), X(.0155), Y(L.mouthY + .0024)); c.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.name = 'tsukuyo-painted-face';
  return texture;
}

function feltTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d'), img = c.createImageData(size, size);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < size * size; i++) {
    const v = 236 + rand() * 19;
    img.data.set([v, v, v, 255], i * 4);
  }
  c.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ------------------------------------------------------------------ helpers
// Revolve a (r, y) profile around Y with wrap-around indexing (no seam).
function revolve(profile, segments, deform) {
  const pos = [], uv = [], idx = [], n = profile.length;
  for (let s = 0; s < segments; s++) {
    const a = s / segments * Math.PI * 2;
    profile.forEach(([r, y], i) => {
      const p = deform(Math.sin(a) * r, y, Math.cos(a) * r, a, i / (n - 1));
      pos.push(p[0], p[1], p[2]); uv.push(s / segments, i / (n - 1));
    });
  }
  for (let s = 0; s < segments; s++) {
    const s1 = (s + 1) % segments;
    for (let i = 0; i < n - 1; i++) {
      const a = s * n + i, b = s1 * n + i;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function prepare(material) { material.userData.headPart = true; return material; }

// -------------------------------------------------------------------- parts
function buildFace(faceMap) {
  const sphere = new THREE.SphereGeometry(1, 112, 84);
  const p = sphere.attributes.position, n = sphere.attributes.normal, uv = sphere.attributes.uv;
  const dir = V(), point = V(), normal = V();
  for (let i = 0; i < p.count; i++) {
    dir.fromBufferAttribute(p, i).normalize();
    point.copy(ORIGIN).addScaledVector(dir, surfaceDistance(dir));
    p.setXYZ(i, point.x, point.y, point.z);
    sdfNormal(point, normal);
    n.setXYZ(i, normal.x, normal.y, normal.z);
    // Front-facing skin receives the painted face; everything else maps to
    // the plain skin at the canvas edge on the same side.
    let u = (point.x - FACE_BOX.x0) / FACE_BOX.size;
    const v = (point.y - FACE_BOX.y0) / FACE_BOX.size;
    if (normal.z < .08 || point.z < .02) u = point.x < 0 ? 0 : 1;
    uv.setXY(i, clamp(u, 0, 1), clamp(v, 0, 1));
  }
  const material = prepare(new THREE.MeshStandardMaterial({
    map: faceMap, roughness: .82, metalness: 0,
    emissive: 0xffffff, emissiveMap: faceMap, emissiveIntensity: .18,
  }));
  const mesh = new THREE.Mesh(sphere, material);
  mesh.name = 'Tsukuyo face';
  return mesh;
}

function buildEarsAndNeck(skin) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin);
    ear.scale.set(.016, .031, .024);
    ear.position.set(side * .149, 1.294, .006);
    ear.rotation.set(0, side * .35, side * -.12);
    ear.name = `Tsukuyo ear ${side}`;
    group.add(ear);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.043, .049, .15, 24, 1, true), skin);
  neck.position.set(0, 1.205, .004);
  neck.rotation.x = -.08;
  neck.name = 'Tsukuyo neck';
  group.add(neck);
  return group;
}

// Hair is built from tapered, curved clumps that follow the scalp and hang
// into a bob, darkening to teal tips. One merged mesh, vertex coloured.
const HAIR_ORIGIN = V(0, 1.372, 0);
function hairBuilder() {
  const pos = [], col = [], idx = [];
  const dark = new THREE.Color(COLORS.hair), deep = new THREE.Color(COLORS.hairDeep);
  const teal = new THREE.Color(COLORS.teal), tip = new THREE.Color(COLORS.tealTip);
  const tmp = new THREE.Color();
  const colorAt = (y, inner, shade) => {
    tmp.copy(dark).lerp(teal, smooth(1.27, 1.2, y)).lerp(tip, smooth(1.22, 1.18, y));
    if (inner) tmp.lerp(deep, .55);
    return tmp.multiplyScalar(shade);
  };
  const RING = 10;
  function addClump(spine, width, thick, shade = 1, facing = null) {
    const count = spine.length, base = pos.length / 3;
    const T = V(), N = V(), B = V(), axis = V(), q = V();
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1), p = spine[i];
      T.subVectors(spine[Math.min(count - 1, i + 1)], spine[Math.max(0, i - 1)]).normalize();
      axis.set(0, clamp(p.y, 1.3, 1.46), 0);
      N.subVectors(p, axis).normalize();
      if (facing) N.lerp(facing, facing.w).normalize();
      N.addScaledVector(T, -N.dot(T)).normalize();
      B.crossVectors(T, N).normalize();
      const w = width * (.82 + .3 * Math.sin(Math.PI * Math.min(1, t * 1.1))) * Math.pow(1 - smooth(.68, 1, t), .6);
      const h = thick * (1 - .65 * t);
      for (let j = 0; j < RING; j++) {
        const a = j / RING * Math.PI * 2, cx = Math.cos(a), sy = Math.sin(a);
        q.copy(p).addScaledVector(B, cx * w / 2).addScaledVector(N, sy * h / 2 * (sy > 0 ? 1 : .35));
        pos.push(q.x, q.y, q.z);
        const c = colorAt(q.y, sy < -.2, shade);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < count - 1; i++) for (let j = 0; j < RING; j++) {
      const a = base + i * RING + j, b = base + i * RING + (j + 1) % RING;
      idx.push(a, a + RING, b, b, a + RING, b + RING);
    }
  }
  // A continuous surface over (u across, v down) samples, vertex coloured.
  function addSheet(rows, shade = .9) {
    const base = pos.length / 3, nu = rows.length, nv = rows[0].length;
    for (const row of rows) for (const p of row) {
      pos.push(p.x, p.y, p.z);
      const c = colorAt(p.y, false, shade);
      col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nv - 1; j++) {
      const a = base + i * nv + j, b = a + nv;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  function build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  return { addClump, addSheet, build };
}

// Hat placement and crown, shared by the hat and by the hair that must stay
// inside it.
const HAT = {
  position: V(0, 1.462, .006), rotation: new THREE.Euler(-.1, 0, .12, 'YXZ'), scale: V(.93, .96, .93),
  CZ: 1.14,
  crown: [[.178, -.008], [.177, .03], [.172, .064], [.163, .094], [.148, .119], [.126, .137], [.097, .149], [.063, .156], [.029, .16], [.001, .161]],
};
HAT.matrix = new THREE.Matrix4().compose(HAT.position, new THREE.Quaternion().setFromEuler(HAT.rotation), HAT.scale);
HAT.inverse = HAT.matrix.clone().invert();
function crownRadius(y) {
  const c = HAT.crown;
  if (y <= c[0][1]) return c[0][0];
  for (let i = 1; i < c.length; i++) if (y <= c[i][1]) return lerp(c[i - 1][0], c[i][0], (y - c[i - 1][1]) / (c[i][1] - c[i - 1][1]));
  return 0;
}
// Pull any hair above the brim line inside the crown (with a small margin).
function keepUnderHat(position) {
  const p = V();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i).applyMatrix4(HAT.inverse);
    if (p.y < -.02) continue;
    const limit = Math.max(.01, crownRadius(p.y) - .012), r = Math.hypot(p.x, p.z / HAT.CZ);
    if (r <= limit) continue;
    p.x *= limit / r; p.z *= limit / r;
    p.applyMatrix4(HAT.matrix);
    position.setXYZ(i, p.x, p.y, p.z);
  }
}

const dirAt = (phi, e) => V(Math.sin(phi) * Math.cos(e), Math.sin(e), Math.cos(phi) * Math.cos(e));
// Spine of one clump: along the scalp from under the hat, then hanging with
// flare, a soft S-wave and a flicked or tucked tip.
function clumpSpine({ phi, rootPhi = phi, e0, e1, off0, off1, tipY, flare = 0, flick = 0, lift = 0, curl = 0, wave = 0, phase = 0, gap = .008 }) {
  const pts = [];
  const SURF = 9;
  for (let i = 0; i <= SURF; i++) {
    const t = i / SURF, e = lerp(e0, e1, t), ph = lerp(rootPhi, phi, 1 - (1 - t) * (1 - t));
    const d = dirAt(ph, e);
    const y = HAIR_ORIGIN.y + d.y * .17;
    pts.push(HAIR_ORIGIN.clone().addScaledVector(d, surfaceDistance(d, HAIR_ORIGIN) + lerp(off1, off0, smooth(1.33, 1.41, y))));
  }
  const start = pts[pts.length - 1].clone();
  const out = V(Math.sin(phi), 0, Math.cos(phi)), across = V(Math.cos(phi), 0, -Math.sin(phi));
  const drop = start.y - tipY;
  if (drop > .004) {
    const HANG = 10;
    for (let i = 1; i <= HANG; i++) {
      const s = i / HANG, p = start.clone();
      p.y -= drop * s;
      p.addScaledVector(out, flare * Math.pow(s, 1.4) + flick * smooth(.62, 1, s) - curl * smooth(.55, 1, s));
      p.addScaledVector(across, wave * Math.sin(Math.PI * s * 1.25 + phase) * s);
      p.y += lift * smooth(.62, 1, s);
      pts.push(p);
    }
  }
  for (const p of pts) pushOut(p, gap);
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal').getSpacedPoints(28);
}

function buildHair() {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const jitter = s => (rand() - .5) * 2 * s;
  const hair = hairBuilder();

  // Scalp cap under everything, following the head with a small gap. It stops
  // at the hairline: low under the bangs, above the ears, down to the nape.
  const cap = new THREE.SphereGeometry(1, 64, 48);
  {
    const p = cap.attributes.position, d = V(), keep = [];
    const hairline = (x, z) => {
      const phi = Math.abs(Math.atan2(x, z)) / DEG;
      return 1.372 + .02 * smooth(30, 60, phi) - .05 * smooth(62, 84, phi) - .13 * smooth(100, 150, phi);
    };
    for (let i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize();
      const r = surfaceDistance(d, HAIR_ORIGIN) + .014;
      p.setXYZ(i, HAIR_ORIGIN.x + d.x * r, HAIR_ORIGIN.y + d.y * r, HAIR_ORIGIN.z + d.z * r);
    }
    const index = cap.index.array;
    for (let i = 0; i < index.length; i += 3) {
      const ok = [0, 1, 2].every(k => { const v = index[i + k]; return p.getY(v) > hairline(p.getX(v), p.getZ(v)); });
      if (ok) keep.push(index[i], index[i + 1], index[i + 2]);
    }
    cap.setIndex(keep);
    cap.deleteAttribute('uv');
    const colors = [];
    const dark = new THREE.Color(COLORS.hair), teal = new THREE.Color(COLORS.teal);
    for (let i = 0; i < p.count; i++) {
      const c = dark.clone().lerp(teal, smooth(1.27, 1.2, p.getY(i))).multiplyScalar(.8);
      colors.push(c.r, c.g, c.b);
    }
    cap.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    cap.computeVertexNormals();
  }

  // The bob's volume: a closed sheet from under the hat down to the ends,
  // round the back from one side of the face to the other.
  {
    const horizontal = (phi, y) => {
      const d = V(Math.sin(phi), 0, Math.cos(phi));
      let lo = 0, hi = .4;
      for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (headSdf(d.x * mid, y, d.z * mid) < 0) lo = mid; else hi = mid; }
      return lo;
    };
    const rows = [], NP = 60, NY = 28;
    for (let i = 0; i <= NP; i++) {
      const phi = lerp(97, 263, i / NP) * DEG, back = 1 - Math.abs(Math.cos(phi / 2));
      const bottom = 1.2 - .008 * back + .006 * Math.sin(phi * 11);
      const out = V(Math.sin(phi), 0, Math.cos(phi)), row = [];
      for (let j = 0; j <= NY; j++) {
        const y = lerp(1.43, bottom, j / NY);
        const side = Math.pow(Math.abs(Math.sin(phi)), 2);
        const r = horizontal(phi, clamp(y, 1.33, 1.47)) + lerp(.028 + .02 * side, .014, smooth(1.33, 1.41, y)) + (.044 - .018 * back) * Math.pow(smooth(1.34, 1.18, y), 1.3);
        row.push(V(0, y, 0).addScaledVector(out, r));
      }
      rows.push(row);
    }
    hair.addSheet(rows, .68);
  }

  // Back and sides: two layers of wide clumps hanging into a flared bob.
  // Tips mostly flick outward; every third one tucks under.
  for (let layer = 0; layer < 2; layer++) {
    const count = layer ? 13 : 15, from = layer ? 112 : 106, to = 360 - from;
    for (let i = 0; i < count; i++) {
      const phi = lerp(from, to, i / (count - 1)) * DEG + jitter(3 * DEG);
      const back = 1 - Math.abs(Math.cos(phi / 2)); // 0 at the sides, 1 at the back
      const tuck = (i + layer) % 3 === 0;
      hair.addClump(clumpSpine({
        phi, rootPhi: phi * .92, e0: 62 * DEG, e1: (layer ? -2 : -7) * DEG,
        off0: .007, off1: layer ? .066 : .05,
        tipY: 1.178 + jitter(.012) - .008 * back + (tuck ? .01 : 0),
        flare: (layer ? .08 : .062) - .024 * back + jitter(.01),
        flick: tuck ? 0 : .02 + jitter(.008), curl: tuck ? .022 : 0, lift: tuck ? 0 : .014,
        wave: .012 + jitter(.006), phase: rand() * Math.PI * 2, gap: .012,
      }), (layer ? .11 : .118) + jitter(.01), layer ? .028 : .032, (layer ? 1.08 : .94) + jitter(.12));
    }
  }
  // Locks tucked behind the ears: they pass over the ear and fall behind it,
  // giving the bob its width beside the face.
  for (const side of [-1, 1]) {
    for (const [deg, tipY, w] of [[110, 1.186, .1], [119, 1.18, .11]]) {
      const phi = side * deg * DEG;
      hair.addClump(clumpSpine({
        phi, rootPhi: side * (deg - 28) * DEG, e0: 58 * DEG, e1: 4 * DEG, off0: .012, off1: .052,
        tipY: tipY + jitter(.008), flare: .06 + jitter(.008), flick: .01, lift: .006,
        wave: .008, phase: rand() * Math.PI * 2, gap: .016,
      }), w, .03, 1 + jitter(.05));
    }
  }
  // Locks in front of the ears, framing the face and curling in at the chin.
  for (const side of [-1, 1]) {
    for (const [deg, tipY, w, curl] of [[53, 1.226, .07, .02], [62, 1.2, .088, .018], [72, 1.19, .08, .01]]) {
      const phi = side * deg * DEG;
      hair.addClump(clumpSpine({
        phi, rootPhi: side * (deg - 16) * DEG, e0: 58 * DEG, e1: 8 * DEG, off0: .01, off1: .018,
        tipY: tipY + jitter(.006), flare: .022, curl, wave: .006, phase: side, gap: .01,
      }), w, .03, 1 + jitter(.1), Object.assign(V(side * .35, 0, 1).normalize(), { w: .6 }));
    }
  }
  // Side-swept bangs: a few wide clumps reaching the brows, parted slightly.
  const bangs = [
    [-47, 1.378, .068], [-36, 1.358, .082], [-25, 1.346, .086], [-14, 1.34, .084], [-3, 1.352, .08],
    [8, 1.334, .086], [19, 1.346, .084], [30, 1.354, .08], [41, 1.366, .074], [51, 1.382, .062],
  ];
  bangs.forEach(([deg, tipY, width], i) => {
    const phi = deg * DEG, tipE = Math.asin(clamp((tipY - HAIR_ORIGIN.y) / .172, -1, 1));
    hair.addClump(clumpSpine({
      phi, rootPhi: phi + 20 * DEG, e0: 64 * DEG, e1: tipE, off0: .012, off1: .006 + (i % 2) * .003,
      tipY, gap: .005,
    }), width, .013, 1 + jitter(.05));
  });
  // A few finer strands laid over the bangs.
  for (const [deg, tipY] of [[-19, 1.338], [3, 1.332], [25, 1.35]]) {
    const phi = deg * DEG, tipE = Math.asin((tipY - HAIR_ORIGIN.y) / .172);
    hair.addClump(clumpSpine({ phi, rootPhi: phi + 24 * DEG, e0: 60 * DEG, e1: tipE, off0: .016, off1: .01, tipY, gap: .007 }), .032, .009, 1.1);
  }

  const material = prepare(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .7, metalness: 0, side: THREE.DoubleSide,
    emissive: 0x1d1917, emissiveIntensity: .45,
  }));
  const group = new THREE.Group();
  group.name = 'Tsukuyo hair';
  const geometry = hair.build();
  keepUnderHat(geometry.attributes.position); keepUnderHat(cap.attributes.position);
  geometry.computeVertexNormals(); cap.computeVertexNormals();
  const clumps = new THREE.Mesh(geometry, material); clumps.name = 'Tsukuyo hair clumps';
  const scalp = new THREE.Mesh(cap, material); scalp.name = 'Tsukuyo hair cap';
  group.add(scalp, clumps);
  return group;
}

function buildHat() {
  const group = new THREE.Group();
  group.name = 'Tsukuyo fedora';
  const felt = feltTexture();
  const feltMaterial = (options = {}) => prepare(new THREE.MeshStandardMaterial({
    color: COLORS.hat, map: felt, roughness: .95, metalness: 0, emissive: COLORS.hat, emissiveIntensity: .06, ...options,
  }));
  const hatMat = feltMaterial({ side: THREE.DoubleSide }), brimMat = feltMaterial();
  const bandMat = prepare(new THREE.MeshStandardMaterial({ color: COLORS.band, roughness: .72, metalness: 0, emissive: COLORS.band, emissiveIntensity: .1 }));
  // Measured on the sheet: band ≈ .345 wide, crown ≈ .15 tall, brim ≈ .57 wide.
  const CZ = HAT.CZ, BASE = HAT.crown[0][0];
  const crownProfile = HAT.crown;
  const crown = revolve(crownProfile, 96, (x, y, z) => {
    z *= CZ;
    // soft centre dent on top and a slight front pinch
    const top = smooth(.1, .158, y), oval = Math.hypot(x / .075, z / .11);
    y -= .026 * top * (1 - smooth(.55, 1.05, oval));
    x *= 1 - .07 * smooth(.05, .19, z) * smooth(.08, .15, y);
    return [x, y, z];
  });
  const crownMesh = new THREE.Mesh(crown, hatMat); crownMesh.name = 'Fedora crown';
  // Brim: a thin closed profile with a rounded edge, turned down all round.
  const brimProfile = [[.172, .004], [.2, .004], [.226, .0], [.249, -.008], [.268, -.02], [.279, -.029], [.284, -.036], [.279, -.039], [.258, -.021], [.232, -.01], [.2, -.006], [.172, -.006]];
  const brim = revolve(brimProfile, 120, (x, y, z, a) => {
    const r = Math.hypot(x, z), s = smooth(.172, .284, r);
    z *= lerp(CZ, 1.05, s);
    // a touch more droop over the ears and at the nape than at the front
    y -= s * s * (.004 + .012 * Math.abs(Math.sin(a)) + .008 * Math.max(0, -Math.cos(a)));
    return [x, y, z];
  });
  const brimMesh = new THREE.Mesh(brim, brimMat); brimMesh.name = 'Fedora brim';
  const bandProfile = [[BASE + .004, .0], [.177 + .003, .03], [.172 + .003, .05], [.169, .05], [.174, .0]];
  const band = revolve(bandProfile, 96, (x, y, z) => [x, y, z * CZ]);
  const bandMesh = new THREE.Mesh(band, bandMat); bandMesh.name = 'Fedora band';
  // The band's folded end on the character's right side.
  const knot = new THREE.Mesh(new THREE.BoxGeometry(.024, .058, .009), bandMat);
  const ka = -66 * DEG;
  knot.position.set(Math.sin(ka) * .186, .026, Math.cos(ka) * .186 * CZ);
  knot.rotation.set(0, ka, .1);
  knot.name = 'Fedora band knot';
  group.add(crownMesh, brimMesh, bandMesh, knot);
  // Seated on the crown of the head, tipped back and cocked down on the
  // character's right, as drawn on the sheet.
  group.position.copy(HAT.position);
  group.rotation.copy(HAT.rotation);
  group.scale.copy(HAT.scale);
  return group;
}

function buildGlasses() {
  const group = new THREE.Group();
  group.name = 'Tsukuyo round glasses';
  const metal = prepare(new THREE.MeshStandardMaterial({ color: COLORS.glasses, roughness: .38, metalness: .55, emissive: 0x2a1d14, emissiveIntensity: .6 }));
  const L = FACE_LAYOUT, R = .051, TUBE = .0022;
  const front = side => V(side * (L.eyeX + .002), L.eyeY - .008, surfaceZ(side * L.eyeX, L.eyeY - .008) + .022);
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE, 8, 64), metal);
    rim.position.copy(front(side));
    rim.rotation.y = side * .16;
    rim.name = `Glasses rim ${side}`;
    group.add(rim);
    // temple arm from the outer rim back into the hair above the ear
    const outer = rim.position.clone().add(V(side * R * Math.cos(.16), 0, -R * Math.sin(.16)));
    const arm = new THREE.CatmullRomCurve3([outer, V(side * .158, L.eyeY + .004, .09), V(side * .168, L.eyeY + .006, .0), V(side * .16, L.eyeY - .004, -.05)]);
    const temple = new THREE.Mesh(new THREE.TubeGeometry(arm, 24, TUBE * .9, 6), metal);
    temple.name = `Glasses temple ${side}`;
    group.add(temple);
  }
  // inner rim edge, which the 0.16 rad turn brings slightly forward
  const inner = side => front(side).add(V(-side * R * Math.cos(.16), .006, R * Math.sin(.16)));
  const bridge = new THREE.CatmullRomCurve3([inner(-1), V(0, L.eyeY + .008, surfaceZ(0, L.eyeY) + .02), inner(1)]);
  const bridgeMesh = new THREE.Mesh(new THREE.TubeGeometry(bridge, 20, TUBE * .9, 6), metal);
  bridgeMesh.name = 'Glasses bridge';
  group.add(bridgeMesh);
  return group;
}

// ----------------------------------------------------------------- assembly
// Returns the full head in bind-pose model space.
export function buildTsukuyoHead() {
  const faceMap = paintFace();
  const face = buildFace(faceMap);
  const head = new THREE.Group();
  head.name = 'Tsukuyo head';
  const skin = prepare(new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: .82, metalness: 0, emissive: COLORS.skin, emissiveIntensity: .12 }));
  head.add(face, buildEarsAndNeck(skin), buildHair(), buildHat(), buildGlasses());
  return head;
}

// Base colour of each vertex from the supplied texture atlas (glTF UVs have a
// top-left origin). Only vertices above `minY` are sampled.
function sampleVertexColors(geometry, map, minY) {
  const image = map?.image;
  if (!image?.width) return null;
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  const colors = new Float32Array(position.count * 3).fill(-1);
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) < minY) continue;
    const x = clamp(Math.floor(uv.getX(i) * image.width), 0, image.width - 1);
    const y = clamp(Math.floor(uv.getY(i) * image.height), 0, image.height - 1);
    const o = (y * image.width + x) * 4;
    colors[i * 3] = pixels[o] / 255; colors[i * 3 + 1] = pixels[o + 1] / 255; colors[i * 3 + 2] = pixels[o + 2] / 255;
  }
  return colors;
}

// Which triangles of the supplied body belong to its old head. Everything
// skinned to the head joints goes, plus the old bob's teal tips that were
// skinned to the neck and shoulders: teal texels above the collar, and any
// UV island that is mostly teal.
function oldHeadTriangles(source, threshold) {
  const geometry = source.geometry, skeleton = source.skeleton;
  const joints = new Set(HEAD_JOINTS.map(name => skeleton.bones.findIndex(bone => bone.name === name)).filter(i => i >= 0));
  const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  const position = geometry.attributes.position, count = position.count;
  const flagged = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    let weight = 0;
    for (let k = 0; k < 4; k++) if (joints.has(skinIndex.getComponent(i, k))) weight += skinWeight.getComponent(i, k);
    if (weight > threshold) flagged[i] = 1;
  }
  const colors = sampleVertexColors(geometry, source.material?.map, 1.1);
  const index = geometry.index.array;
  if (colors) {
    const teal = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const r = colors[i * 3], g = colors[i * 3 + 1], b = colors[i * 3 + 2];
      // the coat, turtleneck and skin are warm; the old hair is grey-teal
      if (r >= 0 && (g - r) + (b - r) / 2 > -.06) teal[i] = 1;
      if (teal[i] && position.getY(i) > 1.12) flagged[i] = 1;
    }
    // UV islands: vertices connected through shared indices.
    const parent = new Int32Array(count).map((_, i) => i);
    const find = v => { while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; } return v; };
    for (let i = 0; i < index.length; i += 3) {
      const a = find(index[i]);
      parent[find(index[i + 1])] = a; parent[find(index[i + 2])] = a;
    }
    const total = new Map(), tealCount = new Map();
    for (let i = 0; i < count; i++) {
      if (flagged[i] && !teal[i]) continue;
      if (position.getY(i) < 1.1) continue;
      const root = find(i);
      total.set(root, (total.get(root) || 0) + 1);
      if (teal[i]) tealCount.set(root, (tealCount.get(root) || 0) + 1);
    }
    for (let i = 0; i < count; i++) {
      const root = find(i), n = total.get(root);
      if (n && (tealCount.get(root) || 0) / n > .5) flagged[i] = 1;
    }
  }
  const kept = [];
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    if (!(flagged[a] && flagged[b] && flagged[c])) kept.push(a, b, c);
  }
  return kept;
}

// Remove the supplied head (skin, hair, hat and fused glasses) from the
// skinned body and parent the rebuilt head to the Head bone.
export function replaceHead(scene, { threshold = .5 } = {}) {
  let source;
  scene.traverse(node => { if (!source && node.isSkinnedMesh) source = node; });
  if (!source) throw new Error('The detective skin is missing.');
  const skeleton = source.skeleton;
  const headIndex = skeleton.bones.findIndex(bone => bone.name === 'Head');
  if (headIndex < 0) throw new Error('The detective skeleton has no Head bone.');
  const geometry = source.geometry.clone();
  geometry.setIndex(oldHeadTriangles(source, threshold));
  source.geometry = geometry;

  const head = buildTsukuyoHead();
  source.updateMatrixWorld(true);
  const toBone = new THREE.Matrix4().multiplyMatrices(skeleton.boneInverses[headIndex], source.bindMatrix);
  head.applyMatrix4(toBone);
  skeleton.bones[headIndex].add(head);
  return head;
}
