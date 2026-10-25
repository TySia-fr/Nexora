// Materials and procedural textures for the product studio.
// Every texture is drawn on a canvas here: no image files, no third-party assets.
import * as THREE from "three";

export const SIGNAL = "#C8F135";

function luminance(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function canvasTexture(size, draw, { repeat = [1, 1], color = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.anisotropy = 8;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dot grid used as a bump map for speaker grilles and earcup fabric. */
export function dotTexture(repeat = [8, 8], dot = 0.32) {
  return canvasTexture(
    128,
    (ctx, s) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * dot, 0, Math.PI * 2);
      ctx.fill();
    },
    { repeat },
  );
}

/** Woven texture: alternating over/under threads. */
export function weaveTexture(repeat = [6, 6]) {
  return canvasTexture(
    256,
    (ctx, s) => {
      const n = 8;
      const w = s / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const over = (i + j) % 2 === 0;
          const g = ctx.createLinearGradient(
            over ? i * w : 0,
            over ? 0 : j * w,
            over ? i * w + w : 0,
            over ? 0 : j * w + w,
          );
          g.addColorStop(0, "#333");
          g.addColorStop(0.5, "#fff");
          g.addColorStop(1, "#333");
          ctx.fillStyle = g;
          ctx.fillRect(i * w + 1, j * w + 1, w - 2, w - 2);
        }
      }
    },
    { repeat },
  );
}

/** Diagonal braid for cables. */
export function braidTexture(repeat = [1, 60]) {
  return canvasTexture(
    128,
    (ctx, s) => {
      ctx.fillStyle = "#777";
      ctx.fillRect(0, 0, s, s);
      ctx.lineWidth = s / 10;
      for (let k = -2; k < 4; k++) {
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(k * (s / 2), 0);
        ctx.lineTo(k * (s / 2) + s, s);
        ctx.stroke();
        ctx.strokeStyle = "#222";
        ctx.beginPath();
        ctx.moveTo(k * (s / 2) + s, 0);
        ctx.lineTo(k * (s / 2), s);
        ctx.stroke();
      }
    },
    { repeat },
  );
}

/** Fine brushed-metal streaks. */
export function brushedTexture() {
  return canvasTexture(
    512,
    (ctx, s) => {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 1400; i++) {
        const v = 100 + Math.floor(Math.random() * 60);
        ctx.strokeStyle = `rgba(${v},${v},${v},0.5)`;
        ctx.lineWidth = Math.random() * 1.2;
        const y = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s, y + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }
    },
    { repeat: [2, 2] },
  );
}

/** Watch dial: minute ticks, two hands and a signal second hand at 10:09:30. */
export function dialTexture() {
  return canvasTexture(
    1024,
    (ctx, s) => {
      const c = s / 2;
      const g = ctx.createRadialGradient(c, c * 0.8, 0, c, c, c);
      g.addColorStop(0, "#1c1c1f");
      g.addColorStop(1, "#070708");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.translate(c, c);
      for (let i = 0; i < 60; i++) {
        const major = i % 5 === 0;
        ctx.save();
        ctx.rotate((i / 60) * Math.PI * 2);
        ctx.fillStyle = major ? "#ededea" : "#6b6b67";
        ctx.fillRect(-(major ? 5 : 2), -c * 0.92, major ? 10 : 4, major ? c * 0.11 : c * 0.05);
        ctx.restore();
      }
      ctx.fillStyle = "#ededea";
      ctx.font = `600 ${s * 0.045}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText("NEXORA", 0, -c * 0.38);
      ctx.fillStyle = "#8e8e89";
      ctx.font = `${s * 0.03}px monospace`;
      ctx.fillText("ORBIT · 72 BPM", 0, c * 0.45);
      const hand = (angle, len, width, color) => {
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-width / 2, -len, width, len + width * 1.5, width / 2);
        ctx.fill();
        ctx.restore();
      };
      hand(((10 + 9 / 60) / 12) * Math.PI * 2, c * 0.5, 22, "#ededea");
      hand((9.5 / 60) * Math.PI * 2, c * 0.78, 16, "#ededea");
      hand((30 / 60) * Math.PI * 2, c * 0.86, 6, SIGNAL);
      ctx.fillStyle = SIGNAL;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    },
    { color: true },
  );
}

/** Phone wallpaper: a quiet gradient with the clock, so screens never look blank. */
export function screenTexture() {
  return canvasTexture(
    1024,
    (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, s * 0.4, s);
      g.addColorStop(0, "#202024");
      g.addColorStop(0.55, "#0c0c0e");
      g.addColorStop(1, "#050506");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "#ededea";
      ctx.textAlign = "center";
      ctx.font = `300 ${s * 0.16}px monospace`;
      ctx.fillText("10:09", s / 2, s * 0.32);
      ctx.fillStyle = "#8e8e89";
      ctx.font = `${s * 0.03}px monospace`;
      ctx.fillText("SUNDAY 25 OCTOBER", s / 2, s * 0.38);
      ctx.fillStyle = SIGNAL;
      ctx.beginPath();
      ctx.arc(s / 2, s * 0.9, s * 0.012, 0, Math.PI * 2);
      ctx.fill();
    },
    { color: true },
  );
}

/** Soft radial blob, used as an ambient-occlusion contact shadow under objects. */
export function blobTexture() {
  return canvasTexture(256, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

// ---------------------------------------------------------------------------

/** The main shell colour of a product. Light colours read as soft-touch polymer, dark as anodised metal. */
export function shell(hex, { metal } = {}) {
  const light = luminance(hex) > 0.45;
  const isMetal = metal ?? !light;
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    metalness: isMetal ? 0.55 : 0,
    roughness: isMetal ? 0.38 : 0.52,
    clearcoat: isMetal ? 0.15 : 0.35,
    clearcoatRoughness: 0.45,
    sheen: light ? 0.25 : 0,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color("#ffffff"),
  });
}

export function brushedMetal(hex = "#c9cacd") {
  const t = brushedTexture();
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    metalness: 1,
    roughness: 0.28,
    roughnessMap: t,
    bumpMap: t,
    bumpScale: 0.15,
  });
}

export function polishedMetal(hex = "#d6d7da") {
  return new THREE.MeshPhysicalMaterial({ color: hex, metalness: 1, roughness: 0.14 });
}

export function rubber(hex = "#18181a") {
  return new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0, roughness: 0.82 });
}

export function blackGlass() {
  return new THREE.MeshPhysicalMaterial({
    color: "#08080a",
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    reflectivity: 0.6,
  });
}

export function lensGlass() {
  return new THREE.MeshPhysicalMaterial({
    color: "#0b0f14",
    metalness: 0.2,
    roughness: 0.02,
    clearcoat: 1,
    iridescence: 0.6,
    iridescenceIOR: 1.5,
  });
}

export function fabric(hex, repeat = [10, 10], dot = 0.3) {
  const t = dotTexture(repeat, dot);
  const c = new THREE.Color(hex);
  return new THREE.MeshPhysicalMaterial({
    color: c,
    metalness: 0,
    roughness: 0.95,
    bumpMap: t,
    bumpScale: 1.2,
    sheen: 1,
    sheenRoughness: 0.6,
    sheenColor: c.clone().offsetHSL(0, 0, 0.15),
  });
}

export function woven(hex, repeat = [4, 30]) {
  const t = weaveTexture(repeat);
  const c = new THREE.Color(hex);
  return new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: 0.9,
    bumpMap: t,
    bumpScale: 2,
    sheen: 1,
    sheenColor: c.clone().offsetHSL(0, 0, 0.2),
  });
}

export function braided(hex, repeat = [1, 80]) {
  const t = braidTexture(repeat);
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.7,
    bumpMap: t,
    bumpScale: 1.5,
    sheen: 0.6,
  });
}

export function cushion(hex = "#1d1d20") {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.62,
    clearcoat: 0.1,
    sheen: 0.4,
    sheenColor: new THREE.Color("#555"),
  });
}

export function emissive(hex = SIGNAL, intensity = 1.6) {
  return new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: intensity });
}

export function texturedFace(map, { roughness = 0.08 } = {}) {
  return new THREE.MeshPhysicalMaterial({ map, roughness, clearcoat: 1, clearcoatRoughness: 0.02 });
}

/** Cast-concrete surface: low-frequency mottling plus fine grit, as colour and bump. */
export function concrete(hex, repeat = 3) {
  const draw = (ctx, s) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const r = 20 + Math.random() * 140;
      const x = Math.random() * s;
      const y = Math.random() * s;
      const v = 110 + Math.random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${v},${v},${v},0.18)`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 34;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  };
  const bump = canvasTexture(1024, draw, { repeat: [repeat, repeat] });
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.92,
    roughnessMap: bump,
    bumpMap: bump,
    bumpScale: 0.6,
    map: bump,
  });
}
