// Solmar Bay — pedestrians: beachgoers and shoppers strolling the sidewalks.
// They wander, pause, and scatter when a car or a gunshot comes too close.
import * as THREE from 'three';
import { buildFigure } from './player.js';
import { CITY } from './config.js';

const SHIRTS = [0xe84a5f, 0x2a9d8f, 0xf4a261, 0x8ab17d, 0x6d9dc5, 0xe9c46a, 0xb5838d, 0x90be6d];
const SKINS = [0xd9a066, 0xc98a5e, 0x8d5a3b, 0xe8b98a, 0x6b4226];

export class Pedestrians {
  constructor(scene, city, count = 26) {
    this.scene = scene;
    this.city = city;
    this.list = [];
    for (let i = 0; i < count; i++) {
      const fig = buildFigure(
        SHIRTS[i % SHIRTS.length],
        SKINS[i % SKINS.length],
      );
      const p = {
        mesh: fig.group,
        legs: [fig.legL, fig.legR],
        pos: fig.group.position,
        heading: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 1.4,
        phase: Math.random() * 10,
        pause: Math.random() * 4,
        flee: 0,
      };
      // Start on a sidewalk near a road, or on the beach.
      if (Math.random() < 0.3) {
        p.pos.set(-CITY.half + Math.random() * CITY.half * 2, 0, CITY.seaZ - 20 - Math.random() * 30);
      } else {
        const r = city.roadLines[Math.floor(Math.random() * city.roadLines.length)];
        if (r.axis === 'x') p.pos.set(-CITY.half + Math.random() * CITY.half * 2, 0, r.at + 8);
        else p.pos.set(r.at + 8, 0, -CITY.half + Math.random() * CITY.half * 2);
      }
      scene.add(fig.group);
      this.list.push(p);
    }
  }

  scare(pos, radius = 18) {
    for (const p of this.list) {
      if (p.pos.distanceTo(pos) < radius) p.flee = 2.5 + Math.random();
    }
  }

  update(dt, carPositions) {
    for (const p of this.list) {
      // Flee from nearby fast cars.
      if (p.flee <= 0) {
        for (const c of carPositions) {
          if (Math.abs(c.speed) > 6 && p.pos.distanceTo(c.pos) < 7) {
            p.flee = 1.5 + Math.random();
            break;
          }
        }
      }
      if (p.pause > 0 && p.flee <= 0) { p.pause -= dt; continue; }
      // Knocked-down pedestrians get back up after a few seconds.
      if (p.pos.y < -1) {
        p.down = (p.down || 0) + dt;
        if (p.down > 4) { p.pos.y = 0; p.down = 0; }
        continue;
      }
      if (p.flee > 0) {
        p.flee -= dt;
        // Run away from the nearest car.
        let nx = 0, nz = 0;
        for (const c of carPositions) {
          const dx = p.pos.x - c.pos.x, dz = p.pos.z - c.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          nx += dx / d; nz += dz / d;
        }
        const l = Math.hypot(nx, nz) || 1;
        p.heading = Math.atan2(nx / l, nz / l);
        p.pos.x += (nx / l) * 5.5 * dt;
        p.pos.z += (nz / l) * 5.5 * dt;
      } else {
        if (Math.random() < dt * 0.08) p.heading += (Math.random() - 0.5) * 1.6;
        if (Math.random() < dt * 0.05) p.pause = 1 + Math.random() * 3;
        p.pos.x += Math.sin(p.heading) * p.speed * dt;
        p.pos.z += Math.cos(p.heading) * p.speed * dt;
      }
      p.pos.x = THREE.MathUtils.clamp(p.pos.x, -268, 268);
      p.pos.z = THREE.MathUtils.clamp(p.pos.z, -268, 292);
      this.city.resolveCollision(p.pos, 0.6);
      p.mesh.rotation.y = p.heading;
      p.phase += dt * (p.flee > 0 ? 11 : 5);
      const swing = p.flee > 0 ? 0.9 : 0.5;
      p.legs[0].rotation.x = Math.sin(p.phase) * swing;
      p.legs[1].rotation.x = -Math.sin(p.phase) * swing;
    }
  }

  // Pedestrian nearest to a point, for crime detection.
  nearest(pos, maxDist) {
    let best = null, bestD = maxDist;
    for (const p of this.list) {
      const d = p.pos.distanceTo(pos);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
}
