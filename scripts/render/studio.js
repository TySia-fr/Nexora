// Studio scene: one lighting setup for every product, so the catalogue reads as one shoot.
// Exposes window.renderShot(spec) → PNG data URL with a transparent background and a soft
// contact shadow, ready to sit on any page colour.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { builders, productOptions } from "./models.js";
import { blobTexture, concrete } from "./materials.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const deg = THREE.MathUtils.degToRad;
// Optional horizontal fill limit for wide frames (fraction of half-width).
let spec_fillX;

/**
 * Campaign set: a concrete plinth and wall, one hard raking key light and a hidden
 * occluder that throws a diagonal shadow edge across the wall.
 */
function campaignSet(scene, spec, sphere, key, others) {
  const dark = spec.set === "dark";
  const R = sphere.radius;
  const yaw = deg(spec.yaw ?? 0);
  const toCam = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  scene.environmentIntensity = dark ? 0.28 : 0.5;
  for (const o of others) o.intensity *= dark ? 0.55 : 0.6;

  const floorMat = concrete(dark ? "#3a3a3a" : "#d4d3ce", 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R * 30, R * 30), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = concrete(dark ? "#2a2a2a" : "#e2e1dc", 3);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(R * 30, R * 16), wallMat);
  wall.position.copy(sphere.center).addScaledVector(toCam, -R * (spec.wallDistance ?? 2.2));
  wall.position.y = R * 8 - 0.01;
  wall.lookAt(wall.position.clone().add(toCam));
  wall.receiveShadow = true;
  scene.add(wall);

  // Hard, warm-neutral key from high camera-left; shadows crisp but not aliased.
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toCam).normalize();
  key.color.set(dark ? "#fff6ea" : "#ffffff");
  key.intensity = dark ? 4.2 : 3.2;
  key.position
    .copy(sphere.center)
    .addScaledVector(side, -R * 3.2)
    .addScaledVector(toCam, R * 1.6)
    .add(new THREE.Vector3(0, R * 3.4, 0));
  key.shadow.radius = spec.preview ? 2 : 3;
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -R * 6;
  sc.right = sc.top = R * 6;
  sc.updateProjectionMatrix();

  // Occluder: invisible to the camera, but casts a long diagonal edge on the wall.
  const occ = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 6, R * 12),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }),
  );
  occ.castShadow = true;
  occ.position
    .copy(key.position)
    .lerp(sphere.center, 0.38)
    .addScaledVector(side, -R * 0.9)
    .add(new THREE.Vector3(0, R * 0.6, 0));
  occ.lookAt(key.position);
  occ.rotateZ(deg(spec.edge ?? 28));
  occ.translateX(-R * 3.1);
  scene.add(occ);

  const fillLight = new THREE.AmbientLight(0xffffff, dark ? 0.06 : 0.22);
  scene.add(fillLight);
  renderer.setClearColor(dark ? 0x101010 : 0xe2e1dc, 1);
}

function buildScene(spec) {
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.environment = envMap;
  scene.environmentIntensity = 0.75;

  const build = builders[spec.shape];
  if (!build) throw new Error(`Unknown shape ${spec.shape}`);
  const model = build(spec.color, { ...(productOptions[spec.slug] ?? {}), ...(spec.options ?? {}) });
  const group = model.group;
  scene.add(group);

  // Rest on the ground, centred.
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const shift = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  group.position.add(shift);
  group.updateMatrixWorld(true);
  box.setFromObject(group);
  const sphere = box.getBoundingSphere(new THREE.Sphere());

  // Lights.
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-0.6, 1.4, 0.9).multiplyScalar(sphere.radius * 4);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(spec.preview ? 1024 : 4096);
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -sphere.radius * 1.6;
  sc.right = sc.top = sphere.radius * 1.6;
  sc.near = 0.1;
  sc.far = sphere.radius * 10;
  key.shadow.radius = spec.preview ? 4 : 14;
  key.shadow.blurSamples = 25;
  key.shadow.bias = -0.0004;
  key.target.position.copy(sphere.center);
  scene.add(key, key.target);

  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(1, 0.8, -1.2).multiplyScalar(sphere.radius * 4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xf3f1ea, 0.5);
  fill.position.set(1, 0.3, 1).multiplyScalar(sphere.radius * 4);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a86, 0.35));

  if (spec.set) {
    campaignSet(scene, spec, sphere, key, [rim, fill]);
  } else {
    // Ground: cast shadow plus a soft contact blob.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(sphere.radius * 20, sphere.radius * 20),
      new THREE.ShadowMaterial({ opacity: 0.12 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        alphaMap: blobTexture(),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(sphere.center.x, 0.005, sphere.center.z);
    blob.scale.set((box.max.x - box.min.x) * 1.15, (box.max.z - box.min.z) * 1.15, 1);
    scene.add(blob);
  }

  return { scene, group, model, box, sphere };
}

/** All world-space vertices of the model, sampled, for accurate framing. */
function samplePoints(group) {
  const pts = [];
  const v = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += step)
      pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  return pts;
}

function frame(camera, target, dir, points, fill, offsetY, aspect, offsetX = 0) {
  // Iteratively pan and dolly until the projected bounds fill `fill` of the frame.
  let dist = 50;
  const centre = target.clone();
  for (let i = 0; i < 8; i++) {
    camera.position.copy(centre).addScaledVector(dir, dist);
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of points) {
      const n = p.clone().project(camera);
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    const ext = Math.max((maxX - minX) / 2 / (spec_fillX ?? 1), (maxY - minY) / 2);
    dist *= ext / fill;
    // Pan so the bounds are centred (with a vertical offset).
    const cx = (minX + maxX) / 2 - offsetX;
    const cy = (minY + maxY) / 2 - offsetY;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const h = Math.tan(deg(camera.fov / 2)) * dist;
    centre.addScaledVector(right, cx * h * aspect).addScaledVector(up, cy * h);
  }
}

window.renderShot = (spec) => {
  const [w, h] = spec.size ?? [2048, 2048];
  renderer.setSize(w, h, false);
  const { scene, group, model, sphere } = buildScene(spec);
  const camera = new THREE.PerspectiveCamera(spec.fov ?? 24, w / h, 0.1, sphere.radius * 50);

  const view = spec.view === "detail" ? model.detail : model.front;
  const yaw = deg(spec.yaw ?? view.yaw);
  const pitch = deg(spec.pitch ?? view.pitch);
  const dir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  );

  if (spec.view === "detail") {
    const target = model.detail.target.clone().applyMatrix4(group.matrixWorld);
    const dist = (sphere.radius * (view.fill ?? 0.5)) / Math.tan(deg(camera.fov / 2));
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
  } else {
    spec_fillX = spec.fillX;
    frame(
      camera,
      sphere.center.clone(),
      dir,
      samplePoints(group),
      spec.fill ?? 0.74,
      spec.offsetY ?? -0.04,
      w / h,
      spec.offsetX ?? 0,
    );
  }

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  // Annotation anchors projected to percentages of the frame, for overlay callouts.
  const anchors = {};
  for (const [name, p] of Object.entries(model.anchors ?? {})) {
    const n = p.clone().applyMatrix4(group.matrixWorld).project(camera);
    anchors[name] = [+(((n.x + 1) / 2) * 100).toFixed(2), +(((1 - n.y) / 2) * 100).toFixed(2)];
  }
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      for (const m of [].concat(o.material)) {
        for (const k of ["map", "bumpMap", "roughnessMap", "alphaMap"]) m[k]?.dispose();
        m.dispose();
      }
    }
  });
  return { url, anchors };
};

window.studioReady = true;
