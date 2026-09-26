import * as THREE from 'three';

// The rainy night city outside the corridor's left windows (x < -3.6): a
// street three floors down, a row of buildings across it, taller blocks
// behind, a hazy skyline and the sky. Walls are painted on canvases with the
// light already in them (lit rooms, curtains, glow on the wall, rain stains)
// and drawn unlit, so the whole city is a handful of draw calls.
// Everything is seeded, so the view is the same on every visit.

export const STREET_Y = -10;
const FLOOR = 3.4, TILE = 8, SPAN = FLOOR * TILE;   // a facade texture = 8 bays x 8 floors

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texture(c, renderer, repeat = true) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const unlit = (map, extra = {}) => new THREE.MeshBasicMaterial({ map, fog: false, ...extra });

// ------------------------------------------------------------- facades
const WARM = ['#ffcf87', '#ffd9a3', '#ffc070', '#ffe2b8', '#f6b867'];
function paintFacade(kind, random) {
  const S = 1024, cell = S / TILE, [c, g] = canvas(S, S);
  g.fillStyle = { brick: '#2c221d', concrete: '#292d32', tile: '#34302b' }[kind]; g.fillRect(0, 0, S, S);
  // the wall itself
  if (kind === 'brick') {
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (let y = 0; y < S; y += 8) { g.fillRect(0, y, S, 1); for (let x = (y / 8) % 2 ? 0 : 12; x < S; x += 24) g.fillRect(x, y, 1, 8); }
  } else if (kind === 'concrete') {
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i <= TILE; i++) { g.fillRect(0, i * cell - 1, S, 2); g.fillRect(i * cell - 1, 0, 2, S); }
  } else {
    g.fillStyle = 'rgba(255,255,255,.035)';
    for (let i = 0; i < S; i += 6) { g.fillRect(0, i, S, 1); g.fillRect(i, 0, 1, S); }
  }
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(${random() < .5 ? '255,255,255' : '0,0,0'},${random() * .05})`;
    g.fillRect(random() * S, random() * S, 2 + random() * 7, 2 + random() * 7);
  }
  // rooms: warm, cool (TV, fluorescent) or dark
  const rooms = [];
  for (let row = 0; row < TILE; row++) for (let col = 0; col < TILE; col++) {
    const r = random(), x0 = col * cell, y0 = row * cell;
    let w, h, x, y;
    if (kind === 'brick') { w = .46 * cell; h = .52 * cell; x = x0 + (cell - w) / 2; y = y0 + .2 * cell; }
    else if (kind === 'concrete') { w = .86 * cell; h = .42 * cell; x = x0 + .07 * cell; y = y0 + .26 * cell; }
    else { w = .52 * cell; h = .64 * cell; x = x0 + .1 * cell; y = y0 + .12 * cell; }
    rooms.push({ x, y, w, h, x0, y0, state: r < .34 ? 'warm' : r < .41 ? 'cool' : 'dark', tone: WARM[Math.floor(random() * WARM.length)], curtain: random(), ac: random() < .3 });
  }
  // light spilling onto the wall around lit windows
  for (const q of rooms) if (q.state !== 'dark') {
    const cx = q.x + q.w / 2, cy = q.y + q.h / 2, rad = Math.max(q.w, q.h) * 1.1;
    const glow = g.createRadialGradient(cx, cy, rad * .2, cx, cy, rad);
    glow.addColorStop(0, q.state === 'warm' ? 'rgba(255,180,110,.16)' : 'rgba(150,190,255,.12)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  // rain stains under the sills
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${.05 + random() * .12})`; g.fillRect(random() * S, random() * S, 2 + random() * 3, 30 + random() * 170); }
  for (const q of rooms) {
    const { x, y, w, h } = q;
    g.fillStyle = '#4a4540'; g.fillRect(x - 4, y - 4, w + 8, h + 8);                 // frame
    g.fillStyle = '#5c554d'; g.fillRect(x - 7, y + h + 3, w + 14, 6);                // sill
    if (q.state === 'dark') {
      const glass = g.createLinearGradient(0, y, 0, y + h); glass.addColorStop(0, '#1f2b3b'); glass.addColorStop(1, '#0d131b');
      g.fillStyle = glass; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(140,165,200,.08)'; g.beginPath(); g.moveTo(x, y + h * .7); g.lineTo(x + w * .6, y); g.lineTo(x + w * .8, y); g.lineTo(x, y + h); g.fill();
    } else {
      const light = g.createRadialGradient(x + w / 2, y + h * .2, 2, x + w / 2, y + h * .4, Math.max(w, h));
      const tone = q.state === 'warm' ? q.tone : (q.curtain < .5 ? '#bcd6ff' : '#e6eefa');
      light.addColorStop(0, '#fff6e6'); light.addColorStop(.25, tone); light.addColorStop(1, q.state === 'warm' ? '#8a5a2c' : '#4d6b94');
      g.fillStyle = light; g.fillRect(x, y, w, h);
      if (q.state === 'warm') {
        if (q.curtain < .3) {           // curtains drawn at the sides
          g.fillStyle = 'rgba(150,70,25,.55)'; g.fillRect(x, y, w * .24, h); g.fillRect(x + w * .76, y, w * .24, h);
        } else if (q.curtain < .55) {   // closed curtains: an orange glow with folds
          g.fillStyle = 'rgba(210,110,40,.45)'; g.fillRect(x, y, w, h);
          g.fillStyle = 'rgba(90,40,10,.25)'; for (let f = x + 4; f < x + w; f += 9) g.fillRect(f, y, 3, h);
        } else if (q.curtain < .75) {   // blinds
          g.fillStyle = 'rgba(90,55,20,.4)'; for (let f = y + 2; f < y + h; f += 5) g.fillRect(x, f, w, 2);
        } else {                        // open: a lamp and furniture shadow
          g.fillStyle = 'rgba(50,30,15,.5)'; g.fillRect(x, y + h * .72, w, h * .28); g.fillRect(x + w * .15, y + h * .45, w * .18, h * .3);
        }
      } else if (q.curtain < .5) { g.fillStyle = 'rgba(30,50,110,.35)'; g.fillRect(x, y + h * .5, w, h * .5); }
    }
    g.fillStyle = 'rgba(20,20,22,.85)';                                                // mullions
    if (kind === 'concrete') for (let m = 1; m < 4; m++) g.fillRect(x + w * m / 4 - 1, y, 3, h); else g.fillRect(x + w / 2 - 1, y, 3, h);
    if (kind === 'tile') {                                                            // balcony slab and railing
      g.fillStyle = '#4a443d'; g.fillRect(q.x0, q.y0 + .9 * cell, cell, .06 * cell);
      g.fillStyle = 'rgba(15,15,16,.85)'; g.fillRect(q.x0, q.y0 + .62 * cell, cell, 4);
      g.fillStyle = 'rgba(15,15,16,.55)'; for (let b = q.x0 + 3; b < q.x0 + cell; b += 7) g.fillRect(b, q.y0 + .62 * cell, 2, .28 * cell);
    }
    if (q.ac) {                                                                       // air conditioner
      const ax = kind === 'tile' ? q.x0 + .7 * cell : x + w + 10, ay = kind === 'tile' ? q.y0 + .7 * cell : y + h * .55;
      g.fillStyle = '#5f5f5a'; g.fillRect(ax, ay, 30, 20); g.fillStyle = 'rgba(0,0,0,.4)'; for (let k = 3; k < 28; k += 4) g.fillRect(ax + k, ay + 3, 2, 14);
    }
  }
  return c;
}
function paintRoof(random) {
  const [c, g] = canvas(256, 256); g.fillStyle = '#23262b'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${random() < .5 ? '255,255,255' : '0,0,0'},${random() * .08})`; g.fillRect(random() * 256, random() * 256, 2, 2); }
  return c;
}

// ------------------------------------------------------------- geometry
class Quads {
  constructor() { this.p = []; this.u = []; this.c = []; this.i = []; }
  // a b c d counter-clockwise as seen from the front; uv [u0 v0 u1 v1]; tint [r g b] at the bottom and top
  add(a, b, c, d, uv, bottom, top = bottom) {
    const n = this.p.length / 3, [u0, v0, u1, v1] = uv;
    this.p.push(...a, ...b, ...c, ...d); this.u.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.c.push(...bottom, ...bottom, ...top, ...top); this.i.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material); m.matrixAutoUpdate = false; return m;
  }
}
const mul = (t, k) => t.map(v => v * k);

// A building: front face at x = xf (facing the corridor), back at xb.
function building(walls, roofs, { xf, xb, z0, z1, top, tint, random }) {
  const yb = STREET_Y, h = top - yb, uo = Math.floor(random() * TILE) / TILE, vo = Math.floor(random() * TILE) / TILE;
  const V = y => (y - yb) / SPAN + vo;
  walls.add([xf, yb, z1], [xf, yb, z0], [xf, top, z0], [xf, top, z1], [uo, V(yb), uo + (z1 - z0) / SPAN, V(top)], mul(tint, .45), tint);
  const side = mul(tint, .62), d = (xf - xb) / SPAN;
  walls.add([xb, yb, z1], [xf, yb, z1], [xf, top, z1], [xb, top, z1], [uo, V(yb), uo + d, V(top)], mul(side, .45), side);
  walls.add([xf, yb, z0], [xb, yb, z0], [xb, top, z0], [xf, top, z0], [uo, V(yb), uo + d, V(top)], mul(side, .45), side);
  const r = mul(tint, .8);
  roofs.add([xb, top, z1], [xf, top, z1], [xf, top, z0], [xb, top, z0], [0, 0, (xf - xb) / 8, (z1 - z0) / 8], r);
  // parapet: a lighter lip along the top of the front
  const lip = mul(tint, 1.35);
  roofs.add([xf + .06, top - .35, z1], [xf + .06, top - .35, z0], [xf + .06, top + .25, z0], [xf + .06, top + .25, z1], [0, 0, (z1 - z0) / 8, .1], lip);
  return h;
}

// ------------------------------------------------------------- glow sprites
function glowTexture(renderer, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, g] = canvas(128, 128), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner); r.addColorStop(.25, inner.replace(/[\d.]+\)$/, '.45)')); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return texture(c, renderer, false);
}
function glowMaterial(map, color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
}
function flat(parent, w, h, material, x, y, z, rx = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); return m;
}

// Repeated things (lamps, tanks, cars) as one draw call each.
const _o = new THREE.Object3D();
function place(mesh, i, x, y, z, rx = 0, ry = 0, rz = 0) {
  _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.updateMatrix(); mesh.setMatrixAt(i, _o.matrix);
}
function instances(parent, geometry, material, list) {
  const m = new THREE.InstancedMesh(geometry, material, list.length);
  list.forEach((args, i) => place(m, i, ...args));
  m.frustumCulled = false; parent.add(m); return m;
}

// ------------------------------------------------------------- signs
function signTexture(renderer, text, color, { vertical = true, w = 128, h = 512, font = 64 } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#121418'; g.fillRect(10, 10, w - 20, h - 20);
  g.strokeStyle = color; g.lineWidth = 4; g.shadowColor = color; g.shadowBlur = 16; g.strokeRect(18, 18, w - 36, h - 36);
  g.font = `700 ${font}px "Hiragino Sans", "Yu Gothic", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const write = () => { if (vertical) [...text].forEach((ch, i, all) => g.fillText(ch, w / 2, h / 2 + (i - (all.length - 1) / 2) * font * 1.08)); else g.fillText(text, w / 2, h / 2); };
  // neon tube: coloured glow, then a pale hot core
  g.fillStyle = color; g.shadowBlur = 24; write(); write();
  g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.6)'; write();
  return texture(c, renderer, false);
}

// ------------------------------------------------------------- sky and skyline
function paintSky(dawn) {
  const [c, g] = canvas(1024, 1024), sky = g.createLinearGradient(0, 0, 0, 1024);
  if (dawn) { sky.addColorStop(0, '#6f8fae'); sky.addColorStop(.6, '#b8c6cf'); sky.addColorStop(.78, '#f0d2b4'); sky.addColorStop(1, '#c9b6a8'); }
  else { sky.addColorStop(0, '#060b15'); sky.addColorStop(.45, '#0f1a2b'); sky.addColorStop(.7, '#28293b'); sky.addColorStop(.8, '#4a3a47'); sky.addColorStop(1, '#2b2832'); }
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 1024);
  const random = seeded(dawn ? 7 : 3);
  for (let i = 0; i < 140; i++) {        // low rain clouds, lit from below by the city
    const x = random() * 1024, y = 330 + random() * 420, w = 80 + random() * 260, h = 14 + random() * 40;
    const cl = g.createRadialGradient(x, y, 0, x, y, w / 2);
    cl.addColorStop(0, dawn ? 'rgba(255,240,225,.10)' : `rgba(${110 + random() * 40},${80 + random() * 20},${90 + random() * 20},.10)`); cl.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(x, y); g.scale(1, h / w); g.translate(-x, -y); g.fillStyle = cl; g.fillRect(x - w / 2, y - w / 2, w, w); g.restore();
  }
  return c;
}
function paintSkyline(seed, base, dots, towers) {
  const W = 2048, H = 512, [c, g] = canvas(W, H), random = seeded(seed);
  for (let i = 0; i < towers; i++) {
    const w = 18 + random() * 70, x = random() * W, top = H * (.25 + random() * .6);
    g.fillStyle = base; g.fillRect(x, top, w, H - top);
    if (random() < .3) g.fillRect(x + w / 2 - 1, top - 24 - random() * 30, 2, 60);         // antenna
    for (let y = top + 6; y < H - 4; y += 7) for (let xx = x + 3; xx < x + w - 3; xx += 6) {
      if (random() < dots) { g.fillStyle = random() < .75 ? 'rgba(232,184,120,.85)' : 'rgba(170,200,240,.8)'; g.fillRect(xx, y, 3, 3); }
    }
    g.fillStyle = base;
  }
  return c;
}

// ------------------------------------------------------------- the city
export function buildCity(scene, renderer) {
  const random = seeded(20260927), city = new THREE.Group(); city.name = 'city'; scene.add(city);
  const kinds = ['brick', 'concrete', 'tile'];
  const wallMaterials = kinds.map(k => unlit(texture(paintFacade(k, random), renderer), { vertexColors: true }));
  const roofMaterial = unlit(texture(paintRoof(random), renderer), { vertexColors: true });
  const walls = kinds.map(() => new Quads()), roofs = new Quads();
  const glow = glowTexture(renderer), tall = [], lowRoofs = [], nightOnly = [];

  // row 1, across the street; row 2 behind it, taller and hazier
  for (const row of [
    { xf: -16.5, depth: [9, 14], floors: [4, 9], tint: [1, 1, 1] },
    { xf: -33, depth: [10, 14], floors: [8, 16], tint: [.62, .68, .82] },
  ]) {
    for (let z = -80; z < 80;) {
      const width = FLOOR * (2 + Math.floor(random() * 3)) * (row.xf < -20 ? 1.3 : 1);
      const floors = row.floors[0] + Math.floor(random() * (row.floors[1] - row.floors[0] + 1));
      const xf = row.xf - (row.xf < -20 ? random() * 5 : random() < .3 ? .8 : 0);
      const top = STREET_Y + floors * FLOOR + .6, k = Math.floor(random() * 3);
      building(walls[k], roofs, { xf, xb: xf - row.depth[0] - random() * (row.depth[1] - row.depth[0]), z0: z, z1: z + width, top, tint: row.tint, random });
      if (row.xf > -20 && top < 12) lowRoofs.push({ xf, z: z + width / 2, top, width });
      if (row.xf < -20 && floors >= 13) tall.push([xf - 4, top, z + width / 2]);
      z += width + (random() < .3 ? 1.2 + random() * 1.5 : 0);
    }
  }
  walls.forEach((q, i) => city.add(q.mesh(wallMaterials[i])));
  city.add(roofs.mesh(roofMaterial));

  // rooftop things against the sky: water tanks, a lit billboard, aviation lights
  const dark = new THREE.MeshBasicMaterial({ color: 0x14171c, fog: false });
  const tanks = lowRoofs.filter(() => random() < .45).map(r => [r.xf - 3, r.top, r.z + (random() - .5) * r.width * .5]);
  if (tanks.length) {
    instances(city, new THREE.CylinderGeometry(.9, .9, 1.6, 14), dark, tanks.map(([x, y, z]) => [x, y + 1.5, z]));
    instances(city, new THREE.BoxGeometry(1.4, .7, 1.4), dark, tanks.map(([x, y, z]) => [x, y + .35, z]));
  }
  const board = lowRoofs.sort((a, b) => Math.abs(a.z) - Math.abs(b.z))[0];
  const signs = [];
  if (board) {
    const bt = signTexture(renderer, '喫茶・レコード　夜更け', '#ffb35c', { vertical: false, w: 1024, h: 256, font: 96 });
    const panel = flat(city, 9, 2.25, new THREE.MeshBasicMaterial({ map: bt, transparent: true, fog: false, side: THREE.DoubleSide }), board.xf - 1, board.top + 2.2, board.z, 0, Math.PI / 2);
    for (const dz of [-3.6, 3.6]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.15, 2.4, .15), dark); post.position.set(board.xf - 1.1, board.top + .9, board.z + dz); city.add(post); }
    signs.push(panel.material);
  }
  if (tall.length) instances(city, new THREE.BoxGeometry(.12, 5, .12), dark, tall.slice(0, 6).map(([x, top, z]) => [x, top + 2.5, z]));
  const beacons = tall.slice(0, 6).map(([x, top, z], i) => {
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff3b30, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    b.position.set(x, top + 5.1, z); b.scale.setScalar(1.6); city.add(b); b.userData.phase = i * 1.3; return b;
  });

  // vertical neon signs sticking out of the front row, facing up and down the street
  const flickers = [];
  const neon = [['喫茶ルナ', '#ff6fa8'], ['ＢＡＲ', '#63f0ff'], ['質', '#ffc05a'], ['ホテル月見', '#9d8cff'], ['薬', '#7dff9a']];
  neon.forEach(([text, color], i) => {
    const z = -30 + i * 14 + (random() - .5) * 4, y = -1.5 + random() * 3;
    // real signs stick straight out; turned a little so they never show only their edge to the corridor
    const m = flat(city, 1.4, 5.6, new THREE.MeshBasicMaterial({ map: signTexture(renderer, text, color), transparent: true, fog: false, side: THREE.DoubleSide }), -15.6, y, z, 0, i % 2 ? .55 : -.55);
    signs.push(m.material);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: .35 }));
    halo.position.set(-15.4, y, z); halo.scale.set(4, 8, 1); city.add(halo); signs.push(halo.material);
    // its colour on the wet road below
    const streak = flat(city, 1.2, 7, glowMaterial(glow, color, .35), -12.2, STREET_Y + .03, z); streak.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    signs.push(streak.material);
    if (i === 3) flickers.push(m.material, halo.material, streak.material);
  });

  // the street: wet asphalt, sidewalks, street lamps and their reflections
  {
    const [c, g] = canvas(256, 1024); g.fillStyle = '#141619'; g.fillRect(0, 0, 256, 1024);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${random() < .5 ? '255,255,255' : '0,0,0'},${random() * .06})`; g.fillRect(random() * 256, random() * 1024, 2, 2); }
    g.fillStyle = 'rgba(210,190,140,.55)'; for (let y = 0; y < 1024; y += 128) g.fillRect(126, y, 4, 64);   // centre dashes
    g.fillStyle = 'rgba(220,220,220,.4)'; g.fillRect(6, 0, 3, 1024); g.fillRect(247, 0, 3, 1024);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,140,170,${.04 + random() * .06})`; g.fillRect(random() * 256, random() * 1024, 20 + random() * 60, 6 + random() * 18); }  // puddles
    const road = texture(c, renderer); road.repeat.set(1, 180 / 64);
    flat(city, 9.5, 180, unlit(road), -10.75, STREET_Y, 0, -Math.PI / 2);
    const walk = new THREE.MeshBasicMaterial({ color: 0x2a2b2e, fog: false });
    for (const [x, w] of [[-4.9, 2.2], [-16, 1.1]]) { const s = flat(city, w, 180, walk, x, STREET_Y + .15, 0); s.rotation.set(-Math.PI / 2, 0, 0); }
    const lamps = [];
    for (let z = -70; z <= 70; z += 14) for (const side of [-1, 1]) {
      const x = side < 0 ? -6.4 : -15.1, arm = side < 0 ? -1.1 : 1.1;
      lamps.push({ x, arm, z: z + (side < 0 ? 0 : 7) });
    }
    instances(city, new THREE.BoxGeometry(.14, 6.4, .14), dark, lamps.map(l => [l.x, STREET_Y + 3.2, l.z]));
    instances(city, new THREE.BoxGeometry(1.1, .1, .1), dark, lamps.map(l => [l.x + l.arm / 2, STREET_Y + 6.35, l.z]));
    // glow of the lamp heads (facing the corridor), their pools and streaks on the wet road
    nightOnly.push(
      instances(city, new THREE.PlaneGeometry(2.6, 2.6), glowMaterial(glow, 0xffd39a), lamps.map(l => [l.x + l.arm, STREET_Y + 6.2, l.z, 0, Math.PI / 2])),
      instances(city, new THREE.PlaneGeometry(6, 6), glowMaterial(glow, 0xffb867, .5), lamps.map(l => [l.x + l.arm, STREET_Y + .04, l.z, -Math.PI / 2])),
      instances(city, new THREE.PlaneGeometry(1, 6), glowMaterial(glow, 0xffc98a, .28), lamps.map(l => [l.x + l.arm + 2.6, STREET_Y + .05, l.z, -Math.PI / 2, 0, Math.PI / 2])));
  }

  // cars: dark bodies, head and tail lights, their beams on the road
  const cars = [];
  for (let i = 0; i < 5; i++) cars.push({ dir: i % 2 ? -1 : 1, x: i % 2 ? -12.6 : -8.9, z: -90 + i * 41, speed: 7 + random() * 4 });
  const n = cars.length;
  const carParts = {
    body: new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, .9, 4.3), new THREE.MeshBasicMaterial({ color: 0x0e1014, fog: false }), n),
    roof: new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, .6, 2.3), new THREE.MeshBasicMaterial({ color: 0x1d2128, fog: false }), n),
    head: new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.1), glowMaterial(glow, 0xfff1d0), n * 2),
    tail: new THREE.InstancedMesh(new THREE.PlaneGeometry(.8, .8), glowMaterial(glow, 0xff2a1a), n * 2),
    beam: new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4, 8), glowMaterial(glow, 0xfff0c8, .35), n),
  };
  for (const m of Object.values(carParts)) { m.frustumCulled = false; city.add(m); }
  const placeCars = () => {
    cars.forEach((c, i) => {
      const y = STREET_Y, d = c.dir;
      place(carParts.body, i, c.x, y + .55, c.z); place(carParts.roof, i, c.x, y + 1.25, c.z - .3 * d);
      [-.65, .65].forEach((dx, k) => {
        place(carParts.head, i * 2 + k, c.x + dx, y + .6, c.z + 2.2 * d, 0, Math.PI / 2);
        place(carParts.tail, i * 2 + k, c.x + dx, y + .7, c.z - 2.2 * d, 0, Math.PI / 2);
      });
      place(carParts.beam, i, c.x, y + .04, c.z + 6.2 * d, -Math.PI / 2);
    });
    for (const m of Object.values(carParts)) m.instanceMatrix.needsUpdate = true;
  };
  placeCars();

  // skyline rings and the sky, on the far side only (x < 0)
  const ring = (radius, height, y, map, extra = {}) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, Math.PI, Math.PI), unlit(map, { side: THREE.BackSide, ...extra }));
    m.position.y = y; city.add(m); return m;
  };
  const skyNight = texture(paintSky(false), renderer, false), skyDawn = texture(paintSky(true), renderer, false);
  const sky = ring(150, 320, 100, skyNight, { depthWrite: false });
  sky.renderOrder = -2;
  const far = ring(125, 70, STREET_Y + 25, texture(paintSkyline(11, '#20253a', .05, 150), renderer), { alphaTest: .5 });
  far.material.map.repeat.set(3, 1);
  const near = ring(92, 90, STREET_Y + 35, texture(paintSkyline(12, '#151a26', .1, 110), renderer), { alphaTest: .5 });
  near.material.map.repeat.set(2, 1);

  city.traverse(o => { o.castShadow = false; o.receiveShadow = false; });

  let flicker = 0;
  return {
    group: city,
    update(dt, time) {
      for (const c of cars) {
        c.z += c.dir * c.speed * dt;
        if (c.z > 90) c.z = -90; else if (c.z < -90) c.z = 90;
      }
      placeCars();
      for (const b of beacons) b.material.opacity = Math.sin(time * 2.2 + b.userData.phase) > .55 ? 1 : .08;
      // one neon sign stutters now and then
      flicker -= dt;
      if (flicker < 0) flicker = 3 + Math.random() * 5;
      const level = flicker < .35 ? (Math.sin(time * 60) > 0 ? .2 : 1) : 1;
      for (const m of flickers) m.opacity = level * (m.userData.base ??= m.opacity);
    },
    setDawn(on) {
      sky.material.map = on ? skyDawn : skyNight; sky.material.needsUpdate = true;
      for (const m of signs) m.visible = !on;
      for (const b of beacons) b.visible = !on;
      for (const m of nightOnly) m.visible = !on;
      // the walls are painted at night: lift them (and the far haze) into daylight
      for (const m of wallMaterials) m.color.setScalar(on ? 2.3 : 1);
      roofMaterial.color.setScalar(on ? 2 : 1); dark.color.set(on ? 0x3b4048 : 0x14171c);
      for (const r of [far, near]) r.material.color.setRGB(...(on ? [3.2, 3.3, 3.5] : [1, 1, 1]));
    },
  };
}
