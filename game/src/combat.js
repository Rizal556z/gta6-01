// Solmar Bay — combat: pistol shooting with raycasts and tracer lines, a punch,
// rival gang members who shoot back, and hit effects.
import * as THREE from 'three';
import { buildFigure } from './player.js';

const GANG_SHIRTS = [0x9e2b25, 0x7a1f1a, 0xb03a2e];

export class Combat {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.enemies = [];
    this.tracers = [];
    this.ray = new THREE.Raycaster();
    this.enemyFireTimer = 0;
  }

  spawnGang(pos, count) {
    const made = [];
    for (let i = 0; i < count; i++) {
      const fig = buildFigure(GANG_SHIRTS[i % GANG_SHIRTS.length], 0xc98a5e);
      const e = {
        mesh: fig.group, legs: [fig.legL, fig.legR],
        pos: fig.group.position,
        health: 3, phase: Math.random() * 6,
        heading: Math.random() * Math.PI * 2,
        alive: true, shootAt: 1 + Math.random() * 2,
      };
      e.pos.set(pos.x + (Math.random() - 0.5) * 24, 0, pos.z + (Math.random() - 0.5) * 24);
      this.scene.add(fig.group);
      this.enemies.push(e);
      made.push(e);
    }
    return made;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  aliveCount() { return this.enemies.filter((e) => e.alive).length; }

  // Shoot from `origin` along `dir`. Returns the enemy hit (if any).
  shoot(origin, dir, maxDist, cars) {
    this.ray.set(origin, dir);
    this.ray.far = maxDist;
    const targets = [];
    for (const e of this.enemies) if (e.alive) targets.push(e.mesh);
    for (const c of cars) targets.push(c.mesh);
    const hits = this.ray.intersectObjects(targets, true);
    // Tracer line from the muzzle to the hit point (or max range).
    const end = hits.length > 0 ? hits[0].point : origin.clone().add(dir.clone().multiplyScalar(maxDist));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
    if (hits.length === 0) return null;
    // Walk up to the enemy root object.
    let obj = hits[0].object;
    while (obj && obj.parent && obj.parent !== this.scene) obj = obj.parent;
    const enemy = this.enemies.find((e) => e.mesh === obj && e.alive);
    if (enemy) {
      enemy.health -= 1;
      this.bloodBurst(hits[0].point);
      if (enemy.health <= 0) {
        enemy.alive = false;
        enemy.mesh.rotation.x = -Math.PI / 2; // fall over
        enemy.mesh.position.y = 0.3;
      }
      return enemy;
    }
    return null;
  }

  bloodBurst(point) {
    const geo = new THREE.SphereGeometry(0.28, 6, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xc1121f, transparent: true, opacity: 0.9 });
    const puff = new THREE.Mesh(geo, mat);
    puff.position.copy(point);
    this.scene.add(puff);
    this.tracers.push({ line: puff, life: 0.35, shrink: true });
  }

  // Melee: hit anything within 2m in front of the player.
  punch(origin, heading, cars, peds) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    let hitEnemy = null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - origin.x, dz = e.pos.z - origin.z;
      if (Math.hypot(dx, dz) < 2.2 && (dx * fx + dz * fz) > 0) {
        e.health -= 1;
        this.bloodBurst(e.pos.clone().setY(1.2));
        if (e.health <= 0) {
          e.alive = false;
          e.mesh.rotation.x = -Math.PI / 2;
          e.mesh.position.y = 0.3;
        }
        hitEnemy = e;
      }
    }
    return hitEnemy;
  }

  // Gang members wander, then shoot at the player when close.
  update(dt, playerPos, onPlayerShot) {
    this.enemyFireTimer -= dt;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = playerPos.x - e.pos.x, dz = playerPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (dist > 26) {
        // Wander toward the player slowly.
        e.pos.x += (dx / dist) * 2.2 * dt;
        e.pos.z += (dz / dist) * 2.2 * dt;
        e.phase += dt * 6;
        e.legs[0].rotation.x = Math.sin(e.phase) * 0.6;
        e.legs[1].rotation.x = -Math.sin(e.phase) * 0.6;
      } else if (this.enemyFireTimer <= 0 && dist < 30) {
        e.shootAt -= dt;
        if (e.shootAt <= 0) {
          e.shootAt = 1.4 + Math.random() * 1.6;
          const origin = e.pos.clone().setY(1.4);
          const dir = new THREE.Vector3(dx / dist, 0, dz / dist);
          const end = origin.clone().add(dir.multiplyScalar(dist));
          const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
          const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff5544, transparent: true, opacity: 0.9 }));
          this.scene.add(line);
          this.tracers.push({ line, life: 0.08 });
          onPlayerShot(Math.random() < 0.45);
          this.enemyFireTimer = 0.25;
        }
      }
      this.city.resolveCollision(e.pos, 0.6);
    }
    // Fade tracers and puffs.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.shrink) t.line.scale.multiplyScalar(0.85);
      if (t.life <= 0) { this.scene.remove(t.line); this.tracers.splice(i, 1); }
    }
  }
}
