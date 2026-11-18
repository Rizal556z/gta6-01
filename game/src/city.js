// Solmar Bay — the city itself: ground, road grid, buildings with lit windows,
// beach, sea, palms, street props and the sky. Everything is procedural geometry.
import * as THREE from 'three';
import { CITY } from './config.js';

function makeWindowTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      const on = Math.random() < 0.42;
      g.fillStyle = on ? lit : '#101c28';
      g.fillRect(x, y, 8, 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.buildings = [];
    this.roadLines = [];   // road centre lines, for traffic + pedestrians
    this.colliders = [];   // {x, z, r} circles the player/cars push out of
    this.build();
  }

  build() {
    const { half, block, roadWidth } = CITY;
    const scene = this.scene;

    // Sky + fog + sun
    scene.background = new THREE.Color(0x87bfe8);
    scene.fog = new THREE.Fog(0x9fc8e8, 180, 620);
    const sun = new THREE.DirectionalLight(0xffe7b0, 2.4);
    sun.position.set(120, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -280; sun.shadow.camera.right = 280;
    sun.shadow.camera.top = 280; sun.shadow.camera.bottom = -280;
    sun.shadow.camera.far = 600;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xbfd9ff, 0.85));
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3a5a3a, 0.5);
    scene.add(hemi);

    // Ground: grass-green base for the whole island
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 200, half * 2 + 200),
      new THREE.MeshLambertMaterial({ color: 0x4d8a4a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Roads: dark asphalt strips on the grid, with pale centre dashes.
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
    const n = Math.floor((half * 2) / block);
    for (let i = 0; i <= n; i++) {
      const p = -half + i * block;
      for (const horizontal of [true, false]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, roadWidth), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = horizontal ? 0 : Math.PI / 2;
        road.position.set(horizontal ? 0 : p, 0.02, horizontal ? p : 0);
        road.receiveShadow = true;
        scene.add(road);
        // centre dashes
        for (let d = -half; d < half; d += 16) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.7), dashMat);
          dash.rotation.x = -Math.PI / 2;
          dash.rotation.z = horizontal ? 0 : Math.PI / 2;
          dash.position.set(horizontal ? d : p, 0.03, horizontal ? p : d);
          scene.add(dash);
        }
      }
      if (i < n) {
        this.roadLines.push({ axis: 'x', at: -half + i * block + block / 2 });
        this.roadLines.push({ axis: 'z', at: -half + i * block + block / 2 });
      }
    }

    // Buildings: one per block cell, jittered, with window textures.
    const palette = ['#7a5c4e', '#c9a06a', '#5e7d8c', '#8c5e6d', '#6d7a52', '#a08c5e', '#4e6d8c', '#9c7a52'];
    const winTex = palette.map((p) => makeWindowTexture(p, Math.random() < 0.5 ? '#ffd98a' : '#9fd8ff'));
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const mats = winTex.map((t) => new THREE.MeshLambertMaterial({ map: t }));
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    let bi = 0;
    for (let gx = 0; gx < n; gx++) {
      for (let gz = 0; gz < n; gz++) {
        // Keep the central plaza and the mission spots clear.
        const cx = -half + gx * block + block / 2;
        const cz = -half + gz * block + block / 2;
        if (Math.abs(cx - 40) < 40 && Math.abs(cz + 40) < 40) continue; // safehouse plaza
        if (Math.abs(cx + 210) < 30 && Math.abs(cz + 190) < 30) continue; // docks yard
        if (Math.random() < 0.18) continue; // empty lots / parks
        const w = 22 + Math.random() * 12;
        const d = 22 + Math.random() * 12;
        const h = 14 + Math.random() * (Math.abs(cx) + Math.abs(cz) < 120 ? 70 : 34);
        const m = new THREE.Mesh(boxGeo, mats[bi++ % mats.length]);
        m.scale.set(w, h, d);
        m.position.set(cx + (Math.random() - 0.5) * 4, h / 2, cz + (Math.random() - 0.5) * 4);
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 1, 1, d + 1);
        roof.position.set(m.position.x, h + 0.5, m.position.z);
        scene.add(roof);
        this.buildings.push(m);
        this.colliders.push({ x: m.position.x, z: m.position.z, r: Math.max(w, d) * 0.62 });
      }
    }

    // Beach + sea on the south edge (+z).
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 200, 90),
      new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.04, CITY.seaZ - 10);
    sand.receiveShadow = true;
    scene.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 400, 300),
      new THREE.MeshLambertMaterial({ color: 0x1e7fa8, transparent: true, opacity: 0.92 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, CITY.seaZ + 130);
    scene.add(sea);
    this.sea = sea;
    this.palmLeaves = [];

    // Palm trees along the beach and the main avenue.
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
    const leafGeo = new THREE.ConeGeometry(3.4, 3.2, 7);
    const palmSpots = [];
    for (let x = -half; x <= half; x += 26) palmSpots.push([x, CITY.seaZ - 38]);
    for (let z = -half; z <= half; z += 40) palmSpots.push([-half + 8, z]);
    for (const [x, z] of palmSpots) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 3.5, z); trunk.castShadow = true;
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x, 8.2, z); leaves.castShadow = true;
      scene.add(trunk); scene.add(leaves);
      this.palmLeaves.push(leaves);
      this.colliders.push({ x, z, r: 1 });
    }

    // Street lamps on road corners.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
    const bulbGeo = new THREE.SphereGeometry(0.45, 8, 6);
    for (let gx = 0; gx <= n; gx += 2) {
      for (let gz = 0; gz <= n; gz += 2) {
        const x = -half + gx * block + roadWidth / 2 + 1;
        const z = -half + gz * block + roadWidth / 2 + 1;
        if (Math.abs(z) > CITY.seaZ - 60) continue;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 3, z);
        const bulb = new THREE.Mesh(bulbGeo, lampMat);
        bulb.position.set(x, 6.2, z);
        scene.add(pole); scene.add(bulb);
      }
    }

    // Marina tower + docks props (mission landmarks).
    this.addLandmark(210, 210, 0xc23a7d, 'MARINA TOWER');
    this.addLandmark(-210, -190, 0x8a5fc0, 'DOCKSIDE WAREHOUSE');
    this.addLandmark(150, -150, 0xe8c832, "RICO'S GARAGE");
    this.addLandmark(-230, 60, 0x18b5a6, 'NORTH PIER');
  }

  addLandmark(x, z, color, label) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(18, 10, 18),
      new THREE.MeshLambertMaterial({ color }),
    );
    base.position.y = 5; base.castShadow = true;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(13, 8, 4),
      new THREE.MeshLambertMaterial({ color: 0x222831 }),
    );
    roof.position.y = 14; roof.rotation.y = Math.PI / 4;
    g.add(base); g.add(roof);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.colliders.push({ x, z, r: 13 });
    // Floating label sprite, drawn on a canvas.
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 44px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 50);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(36, 6.75, 1);
    spr.position.set(x, 24, z);
    this.scene.add(spr);
  }

  // Gentle ambient motion: the sea breathes and the palms sway.
  update(dt, time) {
    if (this.sea) this.sea.position.y = 0.02 + Math.sin(time * 0.7) * 0.06;
    for (let i = 0; i < this.palmLeaves.length; i++) {
      this.palmLeaves[i].rotation.z = Math.sin(time * 0.9 + i * 1.3) * 0.05;
    }
  }

  // Push a point out of building/palm colliders. Returns true if it collided.
  resolveCollision(p, radius) {
    let hit = false;
    for (const c of this.colliders) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const d2 = dx * dx + dz * dz;
      const min = c.r + radius;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
        hit = true;
      }
    }
    return hit;
  }

  // Nearest point on a road centre line to (x, z) — used by traffic AI.
  nearestRoadPoint(x, z) {
    let best = null, bestD = Infinity;
    for (const r of this.roadLines) {
      const d = r.axis === 'x' ? Math.abs(z - r.at) : Math.abs(x - r.at);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (!best) return { x, z };
    return best.axis === 'x' ? { x, z: best.at } : { x: best.at, z };
  }
}
