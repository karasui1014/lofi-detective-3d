import * as THREE from 'three';

// A complete replacement head for the supplied Meshy "Little Detective":
// face, bob hair with teal ends, fedora, round glasses, ears and neck.
// Built as real geometry in the model's bind-pose space (1.70 units tall,
// +Z forward, Head bone at y≈1.263) and parented to the Head bone, so it
// follows the existing walk animation. Proportions and colours follow the
// 3D figure design the body was generated from, measured on the front view
// with the face 0.30 wide and the chin at y = 1.21.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;

export const HEAD_JOINTS = ['Head', 'head_end', 'headfront'];

const COLORS = {
  skin: '#f4c3a9',
  hair: 0x332c29, hairDeep: 0x161210, teal: 0x4a716e, tealTip: 0x7aa39c,
  hat: 0xa89478, band: 0x46382e,
  glasses: 0xb58f4f,
};

// ---------------------------------------------------------------- head shape
// Signed-distance model: a tall round cranium, a soft rounded lower face, a
// small chin and a tiny nose.
const CRANIUM = { c: [0, 1.405, 0], r: [.165, .195, .175] };
const LOWER_FACE = { c: [0, 1.305, .04], r: [.148, .075, .13] };
const CHIN = { c: [0, 1.248, .085], r: [.068, .04, .052] };
const NOSE = { c: [0, 1.29, .164], r: [.008, .011, .01] };
const ORIGIN = V(0, 1.37, .01);

// Ellipsoid distance (approximate): [cx, cy, cz, 1/rx, 1/ry, 1/rz, rx].
// Flat arrays and Math.sqrt: this runs a few million times while loading.
const ellipsoidData = ({ c, r }) => [c[0], c[1], c[2], 1 / r[0], 1 / r[1], 1 / r[2], r[0]];
const SDF_PARTS = [CRANIUM, LOWER_FACE, CHIN, NOSE].map(ellipsoidData);
function ellipsoid(x, y, z, e) {
  const px = (x - e[0]) * e[3], py = (y - e[1]) * e[4], pz = (z - e[2]) * e[5];
  const qx = px * e[3], qy = py * e[4], qz = pz * e[5];
  const k0 = Math.sqrt(px * px + py * py + pz * pz), k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -e[6];
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }
function headSdf(x, y, z) {
  const [cranium, lower, chin, nose] = SDF_PARTS;
  const d = smin(smin(ellipsoid(x, y, z, cranium), ellipsoid(x, y, z, lower), .05), ellipsoid(x, y, z, chin), .04);
  return smin(d, ellipsoid(x, y, z, nose), .012);
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
// Painted in model units: x ∈ [-.2, .2], y ∈ [1.16, 1.56] fills the canvas.
const FACE_BOX = { x0: -.2, y0: 1.16, size: .4 };
// Measured on the front view: eye centres, half-sizes of the eye opening and
// of the iris, brows, nose, mouth and blush.
export const FACE_LAYOUT = {
  eyeX: .071, eyeY: 1.332, eyeW: .039, eyeH: .042, irisW: .029, irisH: .0355,
  browY: 1.426, noseY: 1.289, mouthY: 1.256, mouthW: .019, cheekX: .084, cheekY: 1.29,
};

// Exported for tools/face.html (texture review).
export function paintFace(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  const S = size / FACE_BOX.size;
  const X = x => (x - FACE_BOX.x0) * S, Y = y => (FACE_BOX.y0 + FACE_BOX.size - y) * S, D = d => d * S;
  const L = FACE_LAYOUT;
  c.fillStyle = COLORS.skin; c.fillRect(0, 0, size, size);
  c.lineCap = 'round'; c.lineJoin = 'round';

  // Soft blush under the eyes.
  for (const side of [-1, 1]) {
    c.save(); c.translate(X(side * L.cheekX), Y(L.cheekY)); c.scale(1, .55);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, D(.05));
    g.addColorStop(0, 'rgba(240,138,124,.58)'); g.addColorStop(.6, 'rgba(244,156,138,.26)'); g.addColorStop(1, 'rgba(247,170,150,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, D(.05), 0, Math.PI * 2); c.fill(); c.restore();
  }

  // Brows: dark, softly arched, thinning toward the outer end.
  c.fillStyle = '#4a3a33';
  for (const side of [-1, 1]) {
    const y = L.browY;
    c.beginPath();
    c.moveTo(X(side * .032), Y(y));
    c.quadraticCurveTo(X(side * .07), Y(y + .01), X(side * .118), Y(y - .004));
    c.quadraticCurveTo(X(side * .072), Y(y + .006), X(side * .033), Y(y - .004));
    c.closePath(); c.fill();
  }

  // Eyes: large, dark blue-green irises in a round opening, heavy upper lash
  // line with a few lashes flicking out at the outer corner.
  for (const side of [-1, 1]) {
    const cx = X(side * L.eyeX), cy = Y(L.eyeY), w = D(L.eyeW), h = D(L.eyeH);
    const inner = cx - side * w * .95, outer = cx + side * w * 1.05;
    const opening = () => {
      c.moveTo(inner, cy + .05 * h);
      c.bezierCurveTo(inner, cy - .8 * h, cx - side * .45 * w, cy - 1.08 * h, cx + side * .1 * w, cy - 1.06 * h);
      c.bezierCurveTo(cx + side * .6 * w, cy - 1.02 * h, outer, cy - .72 * h, outer, cy - .1 * h);
      c.bezierCurveTo(outer, cy + .55 * h, cx + side * .55 * w, cy + .98 * h, cx, cy + h);
      c.bezierCurveTo(cx - side * .6 * w, cy + .98 * h, inner, cy + .6 * h, inner, cy + .05 * h);
    };
    c.save();
    c.beginPath(); opening(); c.closePath(); c.clip();
    const white = c.createLinearGradient(0, cy - 1.1 * h, 0, cy + h);
    white.addColorStop(0, '#cfc6cc'); white.addColorStop(.28, '#f4f0ef'); white.addColorStop(1, '#fdfbf9');
    c.fillStyle = white; c.fillRect(cx - 2 * w, cy - 2 * h, 4 * w, 4 * h);
    // iris, clipped so every layer below stays inside it
    const icx = cx + side * .02 * w, icy = cy + .08 * h, irx = D(L.irisW), iry = D(L.irisH);
    c.save();
    c.beginPath(); c.ellipse(icx, icy, irx, iry, 0, 0, Math.PI * 2); c.clip();
    const iris = c.createLinearGradient(0, icy - iry, 0, icy + iry);
    iris.addColorStop(0, '#141c23'); iris.addColorStop(.35, '#243a43'); iris.addColorStop(.65, '#3b6068');
    iris.addColorStop(.88, '#6a908f'); iris.addColorStop(1, '#8fb2a8');
    c.fillStyle = iris; c.fillRect(icx - irx, icy - iry, 2 * irx, 2 * iry);
    const glow = c.createRadialGradient(icx, icy + .55 * iry, 0, icx, icy + .55 * iry, .75 * irx);
    glow.addColorStop(0, 'rgba(170,215,200,.55)'); glow.addColorStop(1, 'rgba(170,215,200,0)');
    c.fillStyle = glow; c.fillRect(icx - irx, icy - iry, 2 * irx, 2 * iry);
    c.strokeStyle = 'rgba(160,205,195,.18)'; c.lineWidth = D(.001);
    for (const a of [.18, .3, .41, .55, .63, .72, .84]) {
      const t = Math.PI * a;
      c.beginPath(); c.moveTo(icx + Math.cos(t) * irx * .45, icy + Math.sin(t) * iry * .45);
      c.lineTo(icx + Math.cos(t) * irx * .88, icy + Math.sin(t) * iry * .88); c.stroke();
    }
    const pupil = c.createRadialGradient(icx, icy - .04 * iry, 0, icx, icy - .04 * iry, .42 * iry);
    pupil.addColorStop(0, 'rgba(6,10,13,1)'); pupil.addColorStop(.7, 'rgba(10,17,21,.95)'); pupil.addColorStop(1, 'rgba(10,17,21,0)');
    c.fillStyle = pupil; c.beginPath(); c.ellipse(icx, icy - .04 * iry, .34 * irx, .44 * iry, 0, 0, Math.PI * 2); c.fill();
    const lid = c.createLinearGradient(0, icy - iry, 0, icy - .05 * iry);
    lid.addColorStop(0, 'rgba(6,10,14,.7)'); lid.addColorStop(1, 'rgba(6,10,14,0)');
    c.fillStyle = lid; c.fillRect(icx - irx, icy - iry, 2 * irx, iry);
    c.restore();
    c.strokeStyle = 'rgba(14,22,28,.9)'; c.lineWidth = D(.0016);
    c.beginPath(); c.ellipse(icx, icy, irx - D(.0008), iry - D(.0008), 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(icx - .34 * irx, icy - .42 * iry, .24 * irx, .21 * iry, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .85; c.beginPath(); c.ellipse(icx + .36 * irx, icy + .4 * iry, .1 * irx, .085 * iry, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .5; c.beginPath(); c.ellipse(icx - .1 * irx, icy + .5 * iry, .05 * irx, .05 * iry, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    c.restore();
    // double-lid crease
    c.strokeStyle = 'rgba(150,100,86,.55)'; c.lineWidth = D(.0012);
    c.beginPath(); c.moveTo(inner + side * .2 * w, cy - 1.1 * h); c.bezierCurveTo(cx - side * .3 * w, cy - 1.36 * h, cx + side * .5 * w, cy - 1.34 * h, outer - side * .05 * w, cy - .98 * h); c.stroke();
    // upper lash line along the round lid, heavier toward the outer corner
    c.fillStyle = '#1d1514';
    c.beginPath();
    c.moveTo(inner - side * .06 * w, cy + .02 * h);
    c.bezierCurveTo(inner - side * .04 * w, cy - .92 * h, cx - side * .45 * w, cy - 1.2 * h, cx + side * .1 * w, cy - 1.2 * h);
    c.bezierCurveTo(cx + side * .7 * w, cy - 1.24 * h, outer + side * .3 * w, cy - .98 * h, outer + side * .44 * w, cy - .34 * h);
    c.lineTo(outer + side * .08 * w, cy - .12 * h);
    c.bezierCurveTo(outer, cy - .7 * h, cx + side * .6 * w, cy - 1.0 * h, cx + side * .1 * w, cy - 1.03 * h);
    c.bezierCurveTo(cx - side * .45 * w, cy - 1.05 * h, inner, cy - .78 * h, inner + side * .04 * w, cy + .06 * h);
    c.closePath(); c.fill();
    // a few lashes out from the outer corner
    c.strokeStyle = '#1d1514';
    for (const [x0, y0, x1, y1, width] of [[.36, -.42, .56, -.5, .0016], [.26, -.72, .46, -.9, .0014], [.08, -.95, .24, -1.16, .0012]]) {
      c.lineWidth = D(width);
      c.beginPath(); c.moveTo(outer + side * x0 * w, cy + y0 * h);
      c.quadraticCurveTo(outer + side * x1 * w, cy + (y0 + y1) / 2 * h, outer + side * x1 * w, cy + y1 * h); c.stroke();
    }
    // lower lid
    c.strokeStyle = 'rgba(108,70,60,.75)'; c.lineWidth = D(.0013);
    c.beginPath(); c.moveTo(outer - side * .04 * w, cy + .05 * h); c.quadraticCurveTo(outer - side * .22 * w, cy + .88 * h, cx + side * .05 * w, cy + 1.03 * h); c.stroke();
  }

  // Nose: a small shadow under the tip (the tip itself is modelled).
  c.fillStyle = 'rgba(206,138,118,.26)';
  c.beginPath(); c.ellipse(X(.002), Y(L.noseY - .007), D(.0055), D(.0024), 0, 0, Math.PI * 2); c.fill();
  // Mouth: a small, gentle smile with a soft lower-lip shade.
  c.fillStyle = 'rgba(232,158,142,.28)';
  c.beginPath(); c.ellipse(X(0), Y(L.mouthY - .006), D(.012), D(.004), 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#8a4c43'; c.lineWidth = D(.0015);
  c.beginPath(); c.moveTo(X(-L.mouthW), Y(L.mouthY + .0025));
  c.quadraticCurveTo(X(0), Y(L.mouthY - .0065), X(L.mouthW), Y(L.mouthY + .003)); c.stroke();

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
    map: faceMap, roughness: .7, metalness: 0,
    emissive: 0xffffff, emissiveMap: faceMap, emissiveIntensity: .16,
  }));
  const mesh = new THREE.Mesh(sphere, material);
  mesh.name = 'Tsukuyo face';
  return mesh;
}

function buildEarsAndNeck(skin) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin);
    ear.scale.set(.019, .037, .027);
    ear.position.set(side * .157, 1.29, .004);
    ear.rotation.set(0, side * .32, side * -.1);
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
// into a bob, darkening to teal ends. One merged mesh, vertex coloured.
const HAIR_ORIGIN = V(0, 1.405, 0), HAIR_R = .175;
function hairBuilder() {
  const pos = [], col = [], idx = [];
  const dark = new THREE.Color(COLORS.hair), deep = new THREE.Color(COLORS.hairDeep);
  const teal = new THREE.Color(COLORS.teal), tip = new THREE.Color(COLORS.tealTip);
  const tmp = new THREE.Color();
  const colorAt = (y, inner, shade, gloss = 0) => {
    tmp.copy(dark).lerp(teal, smooth(1.31, 1.19, y)).lerp(tip, smooth(1.245, 1.175, y));
    if (inner) tmp.lerp(deep, .55);
    return tmp.multiplyScalar(shade * (1 + gloss * 1.05 * Math.exp(-(((y - 1.445) / .028) ** 2))));
  };
  const RING = 10;
  function addClump(spine, width, thick, shade = 1, facing = null, taper = .68) {
    const count = spine.length, base = pos.length / 3;
    const T = V(), N = V(), B = V(), axis = V(), q = V();
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1), p = spine[i];
      T.subVectors(spine[Math.min(count - 1, i + 1)], spine[Math.max(0, i - 1)]).normalize();
      axis.set(0, clamp(p.y, 1.33, 1.5), 0);
      N.subVectors(p, axis).normalize();
      if (facing) N.lerp(facing, facing.w).normalize();
      N.addScaledVector(T, -N.dot(T)).normalize();
      B.crossVectors(T, N).normalize();
      const w = width * (.82 + .3 * Math.sin(Math.PI * Math.min(1, t * 1.1))) * Math.pow(1 - smooth(taper, 1, t), .6);
      const h = thick * (1 - .65 * t);
      for (let j = 0; j < RING; j++) {
        const a = j / RING * Math.PI * 2, cx = Math.cos(a), sy = Math.sin(a);
        q.copy(p).addScaledVector(B, cx * w / 2).addScaledVector(N, sy * h / 2 * (sy > 0 ? 1 : .35));
        pos.push(q.x, q.y, q.z);
        const c = colorAt(q.y, sy < -.2, shade, Math.max(0, sy) * (.6 + .4 * cx * cx));
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
// inside it. Measured: brim front edge ≈ 1.49, crown top ≈ 1.73.
const HAT = {
  position: V(0, 1.545, .004), rotation: new THREE.Euler(-.03, 0, -.04, 'YXZ'), scale: V(1, 1, 1),
  CZ: 1.1,
  crown: [[.186, -.008], [.182, .03], [.172, .07], [.16, .105], [.146, .135], [.128, .158], [.104, .175], [.074, .186], [.04, .192], [.001, .194]],
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
    const limit = Math.max(.01, crownRadius(p.y) - .014), r = Math.hypot(p.x, p.z / HAT.CZ);
    if (r <= limit) continue;
    p.x *= limit / r; p.z *= limit / r;
    p.applyMatrix4(HAT.matrix);
    position.setXYZ(i, p.x, p.y, p.z);
  }
}

const dirAt = (phi, e) => V(Math.sin(phi) * Math.cos(e), Math.sin(e), Math.cos(phi) * Math.cos(e));
const elevationOf = y => Math.asin(clamp((y - HAIR_ORIGIN.y) / HAIR_R, -1, 1));
// Spine of one clump: along the scalp from under the hat, then hanging with
// flare, a soft S-wave and a flicked or tucked tip.
function clumpSpine({ phi, rootPhi = phi, e0, e1, off0, off1, tipY, flare = 0, flick = 0, lift = 0, curl = 0, wave = 0, phase = 0, gap = .008 }) {
  const pts = [];
  const SURF = 9;
  for (let i = 0; i <= SURF; i++) {
    const t = i / SURF, e = lerp(e0, e1, t), ph = lerp(rootPhi, phi, 1 - (1 - t) * (1 - t));
    const d = dirAt(ph, e);
    const y = HAIR_ORIGIN.y + d.y * HAIR_R;
    pts.push(HAIR_ORIGIN.clone().addScaledVector(d, surfaceDistance(d, HAIR_ORIGIN) + lerp(off1, off0, smooth(1.37, 1.47, y))));
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
  // at the hairline: under the bangs, just above the ears, down to the nape.
  const cap = new THREE.SphereGeometry(1, 64, 48);
  {
    const p = cap.attributes.position, d = V(), keep = [];
    const hairline = (x, z) => {
      const phi = Math.abs(Math.atan2(x, z)) / DEG;
      return 1.42 - .06 * smooth(45, 78, phi) - .015 * smooth(78, 88, phi) - .1 * smooth(100, 150, phi);
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
      const c = dark.clone().lerp(teal, smooth(1.31, 1.19, p.getY(i))).multiplyScalar(.8);
      colors.push(c.r, c.g, c.b);
    }
    cap.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }

  // The bob's volume: a closed sheet from under the hat down to the ends,
  // round the back from behind one ear to behind the other.
  {
    const horizontal = (phi, y) => {
      const d = V(Math.sin(phi), 0, Math.cos(phi));
      let lo = 0, hi = .4;
      for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (headSdf(d.x * mid, y, d.z * mid) < 0) lo = mid; else hi = mid; }
      return lo;
    };
    const rows = [], NP = 72, NY = 30;
    for (let i = 0; i <= NP; i++) {
      const deg = lerp(72, 288, i / NP), phi = deg * DEG, back = 1 - Math.abs(Math.cos(phi / 2));
      const aboveEar = smooth(104, 88, Math.min(deg, 360 - deg));
      const bottom = lerp(1.2 - .008 * back + .006 * Math.sin(phi * 11), 1.34, aboveEar);
      const out = V(Math.sin(phi), 0, Math.cos(phi)), row = [];
      const side = Math.pow(Math.abs(Math.sin(phi)), 2);
      for (let j = 0; j <= NY; j++) {
        const y = lerp(1.52, bottom, j / NY);
        const volume = lerp(.014, .03 + .042 * side, smooth(1.48, 1.39, y));
        const r = horizontal(phi, clamp(y, 1.35, 1.52)) + volume + (.036 - .02 * back) * Math.pow(smooth(1.36, 1.18, y), 1.3);
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
        flare: (layer ? .062 : .048) - .026 * back + jitter(.008),
        flick: tuck ? 0 : .02 + jitter(.008), curl: tuck ? .022 : 0, lift: tuck ? 0 : .014,
        wave: .012 + jitter(.006), phase: rand() * Math.PI * 2, gap: .012,
      }), (layer ? .11 : .118) + jitter(.01), layer ? .028 : .032, (layer ? 1.08 : .94) + jitter(.12));
    }
  }
  // Temple volume above the ears.
  for (const side of [-1, 1]) {
    for (const deg of [78, 88, 98]) {
      const phi = side * deg * DEG;
      hair.addClump(clumpSpine({
        phi, rootPhi: side * (deg - 24) * DEG, e0: 58 * DEG, e1: 14 * DEG, off0: .012, off1: .042,
        tipY: 1.335 + jitter(.008), flare: .018, gap: .018,
      }), .075, .024, 1 + jitter(.08), null, .4);
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
  // Locks in front of the ears, framing the face down to the jaw and curling
  // in a little at the ends. Their broad side faces forward.
  for (const side of [-1, 1]) {
    for (const [deg, tipY, w, curl] of [[69, 1.222, .05, .02], [75, 1.198, .054, .014]]) {
      const phi = side * deg * DEG;
      hair.addClump(clumpSpine({
        phi, rootPhi: side * (deg - 26) * DEG, e0: 58 * DEG, e1: 8 * DEG, off0: .01, off1: .022,
        tipY: tipY + jitter(.006), flare: .022, curl, wave: .006, phase: side, gap: .01,
      }), w, .026, 1 + jitter(.1), Object.assign(V(side * .35, 0, 1).normalize(), { w: .4 }));
    }
  }
  // Bangs: straight clumps over the forehead. Longer on the character's right,
  // where one strand reaches the glasses; shorter on the left, showing the brow.
  const bangs = [
    [-54, 1.43, .05], [-46, 1.41, .056], [-38, 1.378, .062], [-30, 1.39, .058], [-22, 1.352, .066], [-14, 1.37, .058],
    [-7, 1.338, .062], [0, 1.362, .058], [7, 1.39, .06], [14, 1.372, .056], [21, 1.405, .058], [28, 1.43, .056],
    [35, 1.418, .054], [42, 1.445, .052], [49, 1.45, .05], [55, 1.458, .046],
    [-61, 1.415, .05], [-67, 1.4, .05], [61, 1.43, .048], [67, 1.41, .048],
  ];
  bangs.forEach(([deg, tipY, width], i) => {
    const phi = deg * DEG;
    hair.addClump(clumpSpine({
      phi, rootPhi: phi + 16 * DEG, e0: 64 * DEG, e1: elevationOf(tipY), off0: .012, off1: .006 + (i % 2) * .003,
      tipY, gap: .005,
    }), width, .011, 1 + jitter(.08), null, .45);
  });
  // Finer strands laid over the bangs, their tips between the clumps so the
  // fringe reads as hair rather than an even zigzag.
  for (const [deg, tipY] of [[-42, 1.39], [-26, 1.36], [-18, 1.346], [-3, 1.35], [4, 1.375], [11, 1.38], [18, 1.392], [32, 1.425]]) {
    const phi = deg * DEG;
    hair.addClump(clumpSpine({ phi, rootPhi: phi + 24 * DEG, e0: 60 * DEG, e1: elevationOf(tipY), off0: .016, off1: .01, tipY, gap: .007 }), .03, .009, 1.12, null, .4);
  }

  const material = prepare(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .4, metalness: 0, side: THREE.DoubleSide,
    emissive: 0x1d1917, emissiveIntensity: .25,
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
  const CZ = HAT.CZ;
  // Fedora crown: a centre crease front to back, pinched in at the front,
  // sloping a little toward the brim at the front.
  const crown = revolve(HAT.crown, 96, (x, y, z) => {
    z *= CZ;
    const top = smooth(.12, .185, y);
    y -= .028 * top * Math.exp(-((x / .06) ** 2)) * (1 - smooth(.04, .2, Math.abs(z)));
    const r = Math.hypot(x, z / CZ);
    const dimple = .032 * Math.exp(-(((Math.abs(x) - .065) / .04) ** 2)) * smooth(.03, .17, z) * smooth(.05, .15, y);
    if (r > .01) { x *= 1 - dimple / r; z *= 1 - dimple / r; }
    y -= .012 * smooth(-.1, .2, z) * smooth(.08, .18, y);
    return [x, y, z];
  });
  const crownMesh = new THREE.Mesh(crown, hatMat); crownMesh.name = 'Fedora crown';
  // Brim: a thin closed profile with a rounded edge; snapped down at the
  // front and sides, a touch up at the back.
  const brimProfile = [[.18, .004], [.21, .004], [.24, .001], [.27, -.006], [.295, -.016], [.308, -.024], [.312, -.03], [.306, -.034], [.28, -.018], [.25, -.009], [.21, -.006], [.18, -.006]];
  const brim = revolve(brimProfile, 120, (x, y, z, a) => {
    const r = Math.hypot(x, z), s = smooth(.18, .312, r);
    z *= lerp(CZ, 1.03, s);
    y -= s * s * (.024 * Math.max(0, Math.cos(a)) + .026 * Math.abs(Math.sin(a)));
    y += s * s * .012 * Math.max(0, -Math.cos(a));
    return [x, y, z];
  });
  const brimMesh = new THREE.Mesh(brim, brimMat); brimMesh.name = 'Fedora brim';
  const bandProfile = [[.19, 0], [.188, .03], [.184, .05], [.18, .05], [.185, 0]];
  const band = revolve(bandProfile, 96, (x, y, z) => [x, y, z * CZ]);
  const bandMesh = new THREE.Mesh(band, bandMat); bandMesh.name = 'Fedora band';
  // The band's folded end on the character's right side.
  const knot = new THREE.Mesh(new THREE.BoxGeometry(.026, .06, .01), bandMat);
  const ka = -80 * DEG;
  knot.position.set(Math.sin(ka) * .19, .026, Math.cos(ka) * .19 * CZ);
  knot.rotation.set(0, ka, .1);
  knot.name = 'Fedora band knot';
  group.add(crownMesh, brimMesh, bandMesh, knot);
  group.position.copy(HAT.position);
  group.rotation.copy(HAT.rotation);
  group.scale.copy(HAT.scale);
  return group;
}

// Thin gold wire frames: round rims sitting a little lower than the eyes,
// a bridge over the nose, hinges and temples back to the ears.
function buildGlasses() {
  const group = new THREE.Group();
  group.name = 'Tsukuyo round glasses';
  const metal = prepare(new THREE.MeshStandardMaterial({ color: COLORS.glasses, roughness: .3, metalness: .85, emissive: 0x3a2a12, emissiveIntensity: .45 }));
  const R = .051, TUBE = .0017, TURN = .14, RIM_X = .074, RIM_Y = 1.33;
  const front = side => V(side * RIM_X, RIM_Y, surfaceZ(side * RIM_X, RIM_Y) + .026);
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE, 8, 72), metal);
    rim.position.copy(front(side));
    rim.rotation.y = side * TURN;
    rim.name = `Glasses rim ${side}`;
    group.add(rim);
    const outer = rim.position.clone().add(V(side * R * Math.cos(TURN), .002, -R * Math.sin(TURN)));
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(.009, .005, .007), metal);
    hinge.position.copy(outer).add(V(side * .003, 0, -.002));
    hinge.name = `Glasses hinge ${side}`;
    group.add(hinge);
    const arm = new THREE.CatmullRomCurve3([outer, V(side * .158, RIM_Y + .004, .09), V(side * .168, RIM_Y + .002, .01), V(side * .162, RIM_Y - .01, -.045)]);
    const temple = new THREE.Mesh(new THREE.TubeGeometry(arm, 24, TUBE, 6), metal);
    temple.name = `Glasses temple ${side}`;
    group.add(temple);
  }
  // inner rim edge, which the turn brings slightly forward
  const inner = side => front(side).add(V(-side * R * Math.cos(TURN), .006, R * Math.sin(TURN)));
  const bridge = new THREE.CatmullRomCurve3([inner(-1), V(0, RIM_Y + .012, surfaceZ(0, RIM_Y + .012) + .018), inner(1)]);
  const bridgeMesh = new THREE.Mesh(new THREE.TubeGeometry(bridge, 20, TUBE, 6), metal);
  bridgeMesh.name = 'Glasses bridge';
  group.add(bridgeMesh);
  return group;
}

// ----------------------------------------------------------------- assembly
// Everything above is laid out in "design units" (face 0.30 wide, chin at
// y = 1.21). On the figure the whole body is 3.6 heads tall: the head (hat
// top to chin) is 28% of the height and the chin sits just above the
// turtleneck collar, so the design is scaled and lifted onto the body.
export const HEAD_FIT = { scale: .91, chinY: 1.25 };

// Returns the full head in bind-pose model space.
export function buildTsukuyoHead() {
  const faceMap = paintFace();
  const face = buildFace(faceMap);
  const design = new THREE.Group();
  design.name = 'Tsukuyo head design';
  const skin = prepare(new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: .75, metalness: 0, emissive: COLORS.skin, emissiveIntensity: .12 }));
  design.add(face, buildEarsAndNeck(skin), buildHair(), buildHat(), buildGlasses());
  design.scale.setScalar(HEAD_FIT.scale);
  design.position.y = HEAD_FIT.chinY - 1.21 * HEAD_FIT.scale;
  const head = new THREE.Group();
  head.name = 'Tsukuyo head';
  head.add(design);
  return head;
}

// A generated head model (the TRELLIS head, glTF: about 1 unit wide, +Z
// forward, chin at y = -0.345, face 0.437 wide) fitted to the same face width
// and chin height as the built head.
export const HEAD_MODEL_FIT = { scale: .625, chinY: -0.345, z: -.04 };
export function fitHeadModel(model) {
  const design = new THREE.Group();
  design.name = 'Tsukuyo head design';
  design.add(model);
  design.scale.setScalar(HEAD_MODEL_FIT.scale);
  design.position.set(0, HEAD_FIT.chinY - HEAD_MODEL_FIT.chinY * HEAD_MODEL_FIT.scale, HEAD_MODEL_FIT.z);
  model.traverse(node => { if (node.isMesh) { node.castShadow = true; if (node.material) node.material.metalness = 0; } });
  const head = new THREE.Group();
  head.name = 'Tsukuyo head';
  head.add(design);
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
// skinned body and parent the rebuilt head (or the given head model) to the
// Head bone.
export function replaceHead(scene, { threshold = .5, headModel = null, stripOldHead = true } = {}) {
  let source;
  scene.traverse(node => { if (!source && node.isSkinnedMesh) source = node; });
  if (!source) throw new Error('The detective skin is missing.');
  const skeleton = source.skeleton;
  const headIndex = skeleton.bones.findIndex(bone => bone.name === 'Head');
  if (headIndex < 0) throw new Error('The detective skeleton has no Head bone.');
  if (stripOldHead) {  // (already done offline for the -lite model)
    const geometry = source.geometry.clone();
    geometry.setIndex(oldHeadTriangles(source, threshold));
    source.geometry = geometry;
  }

  const head = headModel ? fitHeadModel(headModel) : buildTsukuyoHead();
  source.updateMatrixWorld(true);
  const toBone = new THREE.Matrix4().multiplyMatrices(skeleton.boneInverses[headIndex], source.bindMatrix);
  head.applyMatrix4(toBone);
  skeleton.bones[headIndex].add(head);
  return head;
}
