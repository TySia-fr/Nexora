// Procedural models of the (fictional) NEXORA products.
// Units are centimetres; Y is up, the object rests on y = 0 after framing.
// Each builder returns { group, front, detail }:
//   front  — camera yaw/pitch (degrees) for the main shot
//   detail — a point of interest (object space), yaw/pitch and how much of the frame it fills
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as M from "./materials.js";

const deg = THREE.MathUtils.degToRad;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function mesh(geometry, material, { pos, rot, scale, cast = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot.map(deg));
  if (scale) m.scale.set(...scale);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

/** A rounded-rectangle slab in the XY plane, depth along Z, centred on the origin. */
function slab(w, h, depth, r, bevel = Math.min(depth * 0.35, 0.4), holes = []) {
  const shape = roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.01, r - bevel));
  shape.holes.push(...holes);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 10,
    curveSegments: 48,
  });
  g.center();
  g.computeVertexNormals();
  return g;
}

/** Rounded cylinder (a puck) along Y. */
function puck(radius, height, edge, segments = 96) {
  const pts = [];
  pts.push(new THREE.Vector2(0, -height / 2));
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - edge + Math.cos(a) * edge, -height / 2 + edge + Math.sin(a) * edge));
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - edge + Math.cos(a) * edge, height / 2 - edge + Math.sin(a) * edge));
  }
  pts.push(new THREE.Vector2(0, height / 2));
  return new THREE.LatheGeometry(pts, segments);
}

/** Soft pebble: a squashed sphere with a flattened base. */
function pebble(rx, ry, rz) {
  const g = new THREE.SphereGeometry(1, 128, 96);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i);
    if (y < -0.55) y = -0.55 - (y + 0.55) * 0.15;
    p.setXYZ(i, p.getX(i) * rx, y * ry, p.getZ(i) * rz);
  }
  g.computeVertexNormals();
  return g;
}

function usbC(material) {
  const g = new THREE.Group();
  g.add(mesh(slab(0.9, 0.32, 0.6, 0.16, 0.05), M.polishedMetal(), {}));
  g.add(mesh(slab(0.7, 0.15, 0.62, 0.07, 0.02), material ?? M.rubber("#050505"), {}));
  return g;
}

// ---------------------------------------------------------------------------

export function headphones(color) {
  const g = new THREE.Group();
  const body = M.shell(color);
  const metal = M.brushedMetal("#bfc0c3");
  const light = color === "#D9D8D2";
  const pad = M.cushion(light ? "#a9a69d" : "#1b1b1e");
  const W = 8.6; // half head width
  const cupY = 7;

  for (const side of [-1, 1]) {
    const cup = new THREE.Group();
    // Oval shell, axis along X.
    cup.add(mesh(puck(4.1, 3.0, 1.1), body, { rot: [0, 0, 90], scale: [1, 1, 1] }));
    // Machined outer ring.
    cup.add(
      mesh(new THREE.TorusGeometry(3.25, 0.14, 24, 128), metal, { pos: [side * 1.5, 0, 0], rot: [0, 90, 0] }),
    );
    // Flat outer cap.
    cup.add(mesh(puck(3.1, 0.2, 0.08), body, { pos: [side * 1.45, 0, 0], rot: [0, 0, 90] }));
    // Cushion on the inner face.
    cup.add(
      mesh(new THREE.TorusGeometry(2.85, 1.0, 48, 128), pad, {
        pos: [-side * 1.75, 0, 0],
        rot: [0, 90, 0],
        scale: [1, 1, 0.75],
      }),
    );
    cup.add(
      mesh(puck(2.4, 0.3, 0.1), M.fabric(light ? "#7d7b74" : "#141416", [6, 6]), {
        pos: [-side * 1.9, 0, 0],
        rot: [0, 0, 90],
      }),
    );
    if (side === 1) {
      // Status light and control dial on the right cup only.
      cup.add(
        mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 32), M.emissive(), {
          pos: [1.62, -2.0, 1.1],
          rot: [0, 0, 90],
        }),
      );
      cup.add(mesh(puck(0.55, 0.5, 0.15), metal, { pos: [0.2, 3.95, -1.2] }));
    }
    cup.scale.set(1, 1.22, 1);
    cup.position.set(side * W, cupY, 0);
    g.add(cup);

    // Telescopic stem from cup to band.
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.4, 32), metal, { pos: [side * W, cupY + 5.6, 0] }));
    g.add(mesh(slab(1.0, 1.6, 1.6, 0.4, 0.3), body, { pos: [side * W, cupY + 7.4, 0] }));
  }

  // Headband: a flat metal spine with a cushioned underside.
  const arc = new THREE.EllipseCurve(0, cupY + 7.4, W, 7.2, 0, Math.PI, false);
  const curve3 = new THREE.CatmullRomCurve3(arc.getPoints(64).map((p) => V(p.x, p.y, 0)));
  const spine = mesh(new THREE.TubeGeometry(curve3, 200, 0.42, 32, false), body);
  spine.scale.set(1, 1, 3.4);
  g.add(spine);
  const arcIn = new THREE.EllipseCurve(0, cupY + 7.4, W - 0.75, 6.45, deg(8), Math.PI - deg(8), false);
  const curveIn = new THREE.CatmullRomCurve3(arcIn.getPoints(64).map((p) => V(p.x, p.y, 0)));
  const under = mesh(
    new THREE.TubeGeometry(curveIn, 200, 0.55, 32, false),
    M.fabric("#1a1a1d", [40, 2], 0.25),
  );
  under.scale.set(1, 1, 2.2);
  g.add(under);

  return {
    group: g,
    anchors: {
      ring: V(W + 1.55, cupY + 1.6, 2.6),
      light: V(W + 1.62, cupY - 2.4, 1.1),
      cushion: V(-W + 1.9, cupY + 2.6, 1.6),
      band: V(0, cupY + 14.6, 0),
    },
    front: { yaw: -32, pitch: 8 },
    detail: { target: V(W + 1.2, cupY, 0), yaw: 62, pitch: 10, fill: 0.78 },
  };
}

export function earbuds(color, { lite = false } = {}) {
  const g = new THREE.Group();
  const body = M.shell(color, { metal: false });
  // Case: rounded pill standing upright, lid seam a third from the top.
  const caseW = lite ? 5.6 : 6.2;
  g.add(mesh(new RoundedBoxGeometry(caseW, 4.8, 2.8, 12, 1.3), body, { pos: [0, 2.4, 0] }));
  g.add(
    mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24), M.emissive(), {
      pos: [0, 1.8, 1.31],
      rot: [90, 0, 0],
    }),
  );

  // Two buds in front of the case.
  for (const side of [-1, 1]) {
    const bud = new THREE.Group();
    bud.add(mesh(new THREE.SphereGeometry(1.0, 64, 48), body, { scale: [1, 0.9, 1] }));
    if (!lite)
      bud.add(
        mesh(new THREE.CapsuleGeometry(0.34, 2.0, 12, 32), body, { pos: [0.1, -1.5, 0.2], rot: [0, 0, 8] }),
      );
    bud.add(mesh(puck(0.62, 0.7, 0.3), M.rubber("#2a2a2d"), { pos: [0, 0, -0.9], rot: [90, 0, 0] }));
    bud.add(
      mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 48), M.polishedMetal(), {
        pos: [0, 0, 0.95],
        rot: [90, 0, 0],
      }),
    );
    bud.position.set(side * 2.6 + 0.3, lite ? 1.0 : 2.3, 4.4);
    bud.rotation.set(deg(-10), deg(side * 25), deg(side * -6));
    g.add(bud);
  }
  return {
    group: g,
    front: { yaw: -20, pitch: 12 },
    detail: { target: V(2.9, lite ? 1 : 1.8, 4.4), yaw: -35, pitch: 10, fill: 0.62 },
  };
}

export function phone(color, { size = "regular" } = {}) {
  const dims = { mini: [6.8, 14.2], regular: [7.4, 15.6], pro: [7.8, 16.4] }[size];
  const [w, h] = dims;
  const lenses = size === "pro" ? 3 : 2;
  const g = new THREE.Group();
  const frame = M.shell(color, { metal: true });
  frame.roughness = 0.22;
  const back = M.shell(color);
  back.roughness = 0.6;

  const phoneG = new THREE.Group();
  phoneG.add(mesh(slab(w, h, 0.8, 1.1, 0.3), frame));
  // Matte back panel.
  phoneG.add(mesh(slab(w - 0.25, h - 0.25, 0.04, 1.0, 0.01), back, { pos: [0, 0, -0.41] }));
  // Front glass with wallpaper.
  const screen = new THREE.Mesh(slab(w - 0.3, h - 0.3, 0.04, 1.0, 0.01), [
    M.texturedFace(M.screenTexture()),
    M.blackGlass(),
  ]);
  screen.geometry.groups.forEach((gr, i) => (gr.materialIndex = i === 0 ? 0 : 1));
  // Map UVs of the front face to 0..1.
  {
    const uv = screen.geometry.attributes.uv;
    const pos = screen.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, pos.getX(i) / (w - 0.3) + 0.5, pos.getY(i) / (h - 0.3) + 0.5);
  }
  screen.position.z = 0.41;
  phoneG.add(screen);
  // Camera plateau on the back.
  const plateauW = lenses === 3 ? 4.2 : 3.0;
  const plateau = new THREE.Group();
  plateau.add(mesh(slab(plateauW, plateauW, 0.18, 1.0, 0.07), frame));
  const lensPos =
    lenses === 3
      ? [
          [-0.9, 0.9],
          [-0.9, -0.9],
          [0.95, 0],
        ]
      : [
          [-0.65, 0.65],
          [0.65, -0.65],
        ];
  for (const [x, y] of lensPos) {
    plateau.add(
      mesh(new THREE.CylinderGeometry(0.72, 0.76, 0.22, 64), M.polishedMetal("#9fa1a5"), {
        pos: [x, y, -0.12],
        rot: [90, 0, 0],
      }),
    );
    plateau.add(
      mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.06, 64), M.lensGlass(), {
        pos: [x, y, -0.24],
        rot: [90, 0, 0],
      }),
    );
  }
  const flash = lenses === 3 ? [0.95, 1.25] : [0.65, 0.65];
  plateau.add(
    mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 32), M.emissive("#f3f1e6", 0.3), {
      pos: [flash[0], flash[1], -0.1],
      rot: [90, 0, 0],
    }),
  );
  plateau.position.set(-w / 2 + plateauW / 2 + 0.55, h / 2 - plateauW / 2 - 0.55, -0.5);
  phoneG.add(plateau);
  // Side buttons.
  phoneG.add(mesh(slab(0.2, 1.8, 0.35, 0.1, 0.05), frame, { pos: [w / 2 + 0.05, 2.5, 0] }));
  phoneG.add(mesh(slab(0.2, 1.0, 0.35, 0.1, 0.05), frame, { pos: [-w / 2 - 0.05, 3.2, 0] }));

  // Lean the phone back, showing the camera side at three quarters.
  phoneG.rotation.set(deg(-8), deg(180 + 28), 0);
  phoneG.position.y = h / 2;
  g.add(phoneG);
  // A second phone showing the screen, slightly behind.
  const front = phoneG.clone();
  front.rotation.set(deg(-8), deg(-22), 0);
  front.position.set(w * 1.05, h / 2, -2.5);
  g.add(front);

  return {
    group: g,
    front: { yaw: 0, pitch: 6 },
    detail: { target: V(0.3, h - 2.6, 0.3), yaw: -12, pitch: 6, fill: 0.45 },
  };
}

export function phoneCase(color) {
  const g = new THREE.Group();
  const w = 7.7;
  const h = 15.9;
  const mat = M.shell(color, { metal: false });
  mat.roughness = 0.7;
  // Camera cut-out, top left of the back.
  const cut = new THREE.Path();
  const cx = -w / 2 + 2.25;
  const cy = h / 2 - 2.25;
  const r = 1.05;
  const s = 1.65;
  cut.moveTo(cx - s + r, cy - s);
  cut.lineTo(cx + s - r, cy - s);
  cut.absarc(cx + s - r, cy - s + r, r, -Math.PI / 2, 0);
  cut.lineTo(cx + s, cy + s - r);
  cut.absarc(cx + s - r, cy + s - r, r, 0, Math.PI / 2);
  cut.lineTo(cx - s + r, cy + s);
  cut.absarc(cx - s + r, cy + s - r, r, Math.PI / 2, Math.PI);
  cut.lineTo(cx - s, cy - s + r);
  cut.absarc(cx - s + r, cy - s + r, r, Math.PI, Math.PI * 1.5);
  const caseG = new THREE.Group();
  caseG.add(mesh(slab(w, h, 0.5, 1.2, 0.22, [cut]), mat));
  // Magnet ring, embossed.
  caseG.add(mesh(new THREE.TorusGeometry(2.6, 0.05, 16, 160), mat, { pos: [0, -0.6, -0.26] }));
  caseG.add(
    mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16),
      M.emissive(color === M.SIGNAL ? "#101010" : M.SIGNAL, 0.8),
      { pos: [0, -3.6, -0.26], rot: [90, 0, 0] },
    ),
  );
  caseG.rotation.set(deg(-10), deg(180 + 24), 0);
  caseG.position.y = h / 2;
  g.add(caseG);
  return {
    group: g,
    front: { yaw: 0, pitch: 6 },
    detail: { target: V(0.6, h - 2.6, 0), yaw: -10, pitch: 6, fill: 0.45 },
  };
}

export function watch(color) {
  const g = new THREE.Group();
  const caseMat = color === "#A7A9AC" ? M.polishedMetal("#c8c9cc") : M.shell(color, { metal: true });
  const strapMat = M.rubber(color === "#A7A9AC" ? "#2b2b2f" : "#1e1e21");
  const R = 2.25;
  const watchG = new THREE.Group();
  watchG.add(mesh(puck(R, 1.2, 0.45), caseMat, { rot: [90, 0, 0] }));
  // Bezel and domed glass with the dial.
  watchG.add(
    mesh(new THREE.TorusGeometry(R - 0.18, 0.12, 24, 128), M.polishedMetal(), { pos: [0, 0, 0.58] }),
  );
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(R - 0.3, 128),
    M.texturedFace(M.dialTexture(), { roughness: 0.1 }),
  );
  dial.position.z = 0.6;
  watchG.add(dial);
  // Crown.
  watchG.add(
    mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 48), caseMat, {
      pos: [R + 0.15, 0.2, 0],
      rot: [0, 0, 90],
    }),
  );
  watchG.add(
    mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.52, 24), M.emissive(), {
      pos: [R + 0.17, 0.2, 0],
      rot: [0, 0, 90],
    }),
  );
  // Strap: two curved segments sweeping back.
  for (const dir of [1, -1]) {
    const pts = [
      V(0, dir * (R - 0.4), -0.1),
      V(0, dir * (R + 1.8), -0.6),
      V(0, dir * (R + 3.2), -2.2),
      V(0, dir * (R + 3.6), -4.4),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const strap = mesh(new THREE.TubeGeometry(curve, 80, 0.3, 24, false), strapMat);
    strap.scale.set(5.2, 1, 1);
    watchG.add(strap);
  }
  watchG.rotation.set(deg(-18), deg(-24), 0);
  watchG.position.y = R + 2.2;
  g.add(watchG);
  return {
    group: g,
    front: { yaw: 0, pitch: 10 },
    detail: { target: V(0.6, R + 2.4, 0.4), yaw: -20, pitch: 14, fill: 0.5 },
  };
}

export function band(color) {
  const g = new THREE.Group();
  const mat = M.woven(color, [3, 40]);
  // A strap curled into a loose loop, lying on the ground.
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const a = t * Math.PI * 1.65 - Math.PI * 0.3;
    const r = 4.2 - t * 0.6;
    pts.push(V(Math.cos(a) * r, 0.25 + t * 0.6, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const strap = mesh(new THREE.TubeGeometry(curve, 240, 0.22, 24, false), mat);
  // Flatten the tube into a ribbon standing on its edge.
  strap.geometry.scale(1, 5.4, 1);
  strap.geometry.computeVertexNormals();
  strap.position.y = 1.2;
  g.add(strap);
  // Steel buckle at one end.
  const end = curve.getPoint(0);
  g.add(
    mesh(slab(0.6, 2.6, 0.8, 0.2, 0.15), M.polishedMetal(), { pos: [end.x, 2.6, end.z], rot: [0, 20, 0] }),
  );
  return {
    group: g,
    front: { yaw: -15, pitch: 28 },
    detail: { target: V(end.x, 2.4, end.z), yaw: -40, pitch: 20, fill: 0.7 },
  };
}

export function tag(color) {
  const g = new THREE.Group();
  const body = M.shell(color, { metal: false });
  g.add(mesh(puck(1.6, 0.8, 0.38), body, { pos: [0, 0.4, 0] }));
  g.add(
    mesh(new THREE.TorusGeometry(1.0, 0.03, 16, 128), M.polishedMetal(), {
      pos: [0, 0.81, 0],
      rot: [90, 0, 0],
    }),
  );
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24), M.emissive(), { pos: [0, 0.81, 0] }));
  // Key ring.
  g.add(
    mesh(new THREE.TorusGeometry(0.9, 0.08, 24, 96), M.polishedMetal(), {
      pos: [2.2, 0.18, 0.6],
      rot: [90, 0, 0],
    }),
  );
  g.add(
    mesh(new THREE.TorusGeometry(0.35, 0.12, 16, 48), M.polishedMetal(), {
      pos: [1.45, 0.4, 0.2],
      rot: [0, 30, 90],
    }),
  );
  return {
    group: g,
    front: { yaw: -20, pitch: 34 },
    detail: { target: V(0, 0.6, 0), yaw: -10, pitch: 50, fill: 0.55 },
  };
}

export function speakerColumn(color, { studio = false } = {}) {
  const g = new THREE.Group();
  const shellM = M.shell(color, { metal: false });
  const grille = M.fabric(color, studio ? [26, 70] : [30, 70], studio ? 0.28 : 0.34);
  if (studio) grille.color.offsetHSL(0, 0, -0.04);
  else grille.color.set(new THREE.Color(color).getHSL({}).l > 0.5 ? "#8c8a83" : "#4a4a50");
  if (studio) {
    // Cylindrical column.
    const H = 24;
    g.add(mesh(new THREE.CylinderGeometry(4.2, 4.2, H - 2, 128, 1, true), grille, { pos: [0, H / 2, 0] }));
    g.add(mesh(puck(4.3, 1.2, 0.45), shellM, { pos: [0, H - 0.6, 0] }));
    g.add(mesh(puck(4.3, 1.4, 0.4), M.rubber("#121214"), { pos: [0, 0.7, 0] }));
    g.add(
      mesh(new THREE.TorusGeometry(2.2, 0.06, 16, 160), M.polishedMetal(), {
        pos: [0, H + 0.02, 0],
        rot: [90, 0, 0],
      }),
    );
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24), M.emissive(), { pos: [0, H + 0.03, 0] }));
    return {
      group: g,
      front: { yaw: -20, pitch: 10 },
      detail: { target: V(0, H - 1, 0), yaw: -20, pitch: 35, fill: 0.45 },
    };
  }
  // Monolith: a 120 × 120 × 320 mm column of anodised aluminium, perforated on all four
  // sides for 360° output, with controls on the top face (matches the catalogue spec).
  const W = 12;
  const H = 32;
  const anod = M.shell(color, { metal: true });
  anod.metalness = 0.65;
  anod.roughness = 0.42;
  g.add(mesh(slab(W, H, W, 1.4, 0.55), anod, { pos: [0, H / 2, 0] }));
  // Extrude UVs are in centimetres: repeat = dots per cm.
  const perf = M.fabric(color, [2.6, 2.6], 0.34);
  perf.metalness = 0.5;
  perf.roughness = 0.55;
  perf.sheen = 0;
  perf.map = perf.bumpMap;
  perf.color.offsetHSL(0, 0, -0.02);
  for (let i = 0; i < 4; i++) {
    const panel = mesh(slab(W - 2.4, H - 9, 0.12, 0.6, 0.04), perf, { cast: false });
    const a = (i * Math.PI) / 2;
    panel.position.set(Math.sin(a) * (W / 2 + 0.01), H / 2 - 2.2, Math.cos(a) * (W / 2 + 0.01));
    panel.rotation.y = a;
    g.add(panel);
  }
  // Top controls: a recessed metal ring with three buttons and the status light.
  g.add(
    mesh(new THREE.TorusGeometry(3.2, 0.08, 16, 160), M.polishedMetal(), {
      pos: [0, H + 0.01, 0],
      rot: [90, 0, 0],
    }),
  );
  for (const x of [-1.4, 0, 1.4])
    g.add(mesh(puck(0.42, 0.18, 0.06), M.rubber("#1c1c1e"), { pos: [x, H + 0.05, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24), M.emissive(), { pos: [0, H + 0.02, 1.9] }));
  g.add(mesh(slab(W - 1, W - 1, 0.6, 1.0, 0.2), M.rubber("#121214"), { pos: [0, 0.3, 0], rot: [90, 0, 0] }));
  return {
    group: g,
    front: { yaw: -30, pitch: 9 },
    detail: { target: V(0, H - 0.5, 0), yaw: -25, pitch: 38, fill: 0.36 },
  };
}

export function speakerPebble(color) {
  const g = new THREE.Group();
  const fab = M.fabric(color, [30, 18], 0.3);
  g.add(mesh(pebble(6, 3.6, 5.2), fab, { pos: [0, 2.0, 0] }));
  g.add(mesh(puck(3.6, 0.5, 0.2), M.rubber("#141416"), { pos: [0, 0.25, 0] }));
  g.add(
    mesh(puck(1.3, 0.3, 0.12), M.shell(color === M.SIGNAL ? "#101010" : color, { metal: false }), {
      pos: [0, 5.55, 0],
    }),
  );
  g.add(
    mesh(new THREE.TorusGeometry(1.3, 0.05, 16, 96), M.polishedMetal(), {
      pos: [0, 5.6, 0],
      rot: [90, 0, 0],
    }),
  );
  g.add(
    mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24),
      M.emissive(color === M.SIGNAL ? "#ffffff" : M.SIGNAL),
      { pos: [0, 5.72, 0] },
    ),
  );
  return {
    group: g,
    front: { yaw: -20, pitch: 16 },
    detail: { target: V(0, 5.3, 0), yaw: -20, pitch: 45, fill: 0.4 },
  };
}

export function charger(color, { ports = 1 } = {}) {
  const g = new THREE.Group();
  const s = ports > 1 ? 1.25 : 1;
  const body = M.shell(color, { metal: false });
  body.roughness = 0.45;
  const W = 5 * s;
  const H = 5 * s;
  const D = 3.0 * s;
  const ch = new THREE.Group();
  ch.add(mesh(slab(W, H, D, 1.0, 0.45), body));
  // Port face (front).
  for (let i = 0; i < ports; i++) {
    const y = ports > 1 ? 1.0 - i * 1.0 : 0.4;
    ch.add(
      mesh(slab(1.25, 0.5, 0.06, 0.24, 0.02), M.rubber("#050506"), {
        pos: [0, y * s, D / 2 + 0.01],
        cast: false,
      }),
    );
  }
  ch.add(
    mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 24), M.emissive(), {
      pos: [0, -H / 2 + 0.9, D / 2 + 0.02],
      rot: [90, 0, 0],
    }),
  );
  // EU plug pins on the back.
  for (const x of [-0.95, 0.95]) {
    ch.add(
      mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.9, 32), M.polishedMetal(), {
        pos: [x * s, 0, -D / 2 - 0.95],
        rot: [90, 0, 0],
      }),
    );
  }
  ch.position.y = H / 2;
  g.add(ch);
  return {
    group: g,
    front: { yaw: -30, pitch: 14 },
    detail: { target: V(0, H / 2 + 0.2, D / 2), yaw: -12, pitch: 8, fill: 0.8 },
  };
}

export function cable(color) {
  const g = new THREE.Group();
  const pts = [];
  // A loose coil with both ends trailing out.
  pts.push(V(-9, 0.45, 4), V(-6, 0.45, 3.2));
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 4;
    const r = 4.2 + i * 0.015;
    pts.push(V(Math.cos(a) * r, 0.45 + i * 0.022, Math.sin(a) * r * 0.8));
  }
  pts.push(V(6.5, 0.45, -2), V(9.5, 0.45, -3));
  const curve = new THREE.CatmullRomCurve3(pts);
  g.add(mesh(new THREE.TubeGeometry(curve, 600, 0.3, 24, false), M.braided(color)));
  for (const t of [0, 1]) {
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t).multiplyScalar(t === 0 ? -1 : 1);
    const plug = new THREE.Group();
    plug.add(mesh(slab(1.1, 0.75, 2.6, 0.35, 0.2), M.shell(color), { pos: [0, 0, 1.3] }));
    const c = usbC();
    c.position.z = 2.85;
    plug.add(c);
    plug.position.copy(p);
    plug.lookAt(p.clone().add(tan));
    g.add(plug);
  }
  return {
    group: g,
    front: { yaw: -10, pitch: 38 },
    detail: { target: curve.getPoint(1).add(V(0.4, 0, -0.6)), yaw: -40, pitch: 22, fill: 0.55 },
  };
}

export function travelCase(color) {
  const g = new THREE.Group();
  const shellM = M.fabric(color, [1.6, 1.6], 0.2);
  shellM.bumpScale = 0.5;
  const W = 20;
  const D = 17.5;
  const H = 4.5;
  // Clamshell: two halves meeting at a zip line.
  const half = slab(W, D, H / 2, 6, 1.4);
  g.add(mesh(half, shellM, { pos: [0, H * 0.75, 0], rot: [90, 0, 0] }));
  g.add(mesh(half, shellM, { pos: [0, H * 0.25, 0], rot: [90, 0, 0] }));
  const zip = mesh(slab(W - 0.2, D - 0.2, 0.25, 6, 0.08), M.rubber("#111"), {
    pos: [0, H / 2, 0],
    rot: [90, 0, 0],
  });
  g.add(zip);
  g.add(mesh(slab(1.6, 0.5, 1, 0.2, 0.15), M.polishedMetal(), { pos: [W / 2 - 1.5, H / 2, D / 2 - 0.4] }));
  g.add(mesh(slab(5, 0.4, 1.4, 0.2, 0.15), M.rubber("#1a1a1c"), { pos: [0, H + 0.1, -D / 2 + 1.8] }));
  return {
    group: g,
    front: { yaw: -25, pitch: 30 },
    detail: { target: V(W / 2 - 1.5, H / 2, D / 2 - 0.5), yaw: -35, pitch: 22, fill: 0.7 },
  };
}

export function dock(color) {
  const g = new THREE.Group();
  const alu = M.brushedMetal(color === "#A7A9AC" ? "#c7c8cb" : color);
  const base = slab(16, 7, 1.2, 1.4, 0.4);
  g.add(mesh(base, alu, { pos: [0, 0.6, 0], rot: [90, 0, 0] }));
  // Tilted phone stand.
  const stand = new THREE.Group();
  stand.add(mesh(slab(5.2, 9.5, 0.9, 1.0, 0.3), alu, {}));
  stand.add(
    mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 96), M.rubber("#121214"), {
      pos: [0, 1.0, 0.46],
      rot: [90, 0, 0],
    }),
  );
  stand.position.set(-4.5, 5.6, -1.2);
  stand.rotation.x = deg(-16);
  g.add(stand);
  // Watch puck and earbud pad.
  g.add(mesh(puck(1.3, 0.5, 0.2), M.rubber("#121214"), { pos: [1.5, 1.45, 0.4] }));
  g.add(
    mesh(slab(3.2, 2.6, 0.2, 1.2, 0.08), M.rubber("#121214"), { pos: [5.4, 1.25, 0.4], rot: [90, 0, 0] }),
  );
  g.add(
    mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 24), M.emissive(), {
      pos: [0, 1.0, 3.52],
      rot: [90, 0, 0],
    }),
  );
  return {
    group: g,
    front: { yaw: -22, pitch: 22 },
    detail: { target: V(0, 2.4, 0.4), yaw: -15, pitch: 30, fill: 0.68 },
  };
}

export const builders = {
  headphones,
  earbuds,
  watch,
  band,
  tag,
  phone,
  "speaker-column": speakerColumn,
  "speaker-pebble": speakerPebble,
  charger,
  cable,
  case: phoneCase,
  "travel-case": travelCase,
  dock,
};

/** Per-product tweaks to a shared shape. */
export const productOptions = {
  "pulse-buds-lite": { lite: true },
  "axis-2-mini": { size: "mini" },
  "axis-2-pro": { size: "pro" },
  "column-studio": { studio: true },
  "flux-140w": { ports: 3 },
};
