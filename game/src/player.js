// Solmar Bay — the player on foot: a simple articulated figure, WASD movement,
// sprint, camera-relative heading, and getting in/out of cars.
import * as THREE from 'three';
import { PLAYER } from './config.js';

function buildFigure(shirtColor, skinColor) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.12; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.72; head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38),
    new THREE.MeshLambertMaterial({ color: 0x1c1410 }));
  hair.position.y = 1.94;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.16, 0.36, 0);
  const legR = legL.clone(); legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), shirt);
  armL.position.set(-0.42, 1.14, 0);
  const armR = armL.clone(); armR.position.x = 0.42;
  g.add(torso, head, hair, legL, legR, armL, armR);
  return { group: g, legL, legR, armL, armR };
}

export class Player {
  constructor(scene) {
    const fig = buildFigure(0xff8c42, 0xd9a066);
    this.mesh = fig.group;
    this.legs = [fig.legL, fig.legR];
    this.arms = [fig.armL, fig.armR];
    this.pos = this.mesh.position;
    this.pos.set(0, 0, 40);
    this.heading = Math.PI;      // facing the camera start
    this.yaw = 0;                // camera orbit yaw
    this.health = PLAYER.health;
    this.cash = PLAYER.startCash;
    this.inCar = null;
    this.walkPhase = 0;
    this.speed = 0;
    scene.add(this.mesh);
  }

  // Move on foot. `move` is {x, z} in world space, already camera-relative.
  updateOnFoot(dt, move, running, city) {
    const target = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = move.x, mz = move.z;
    const len = Math.hypot(mx, mz);
    const want = len > 0.01 ? target : 0;
    this.speed += (want - this.speed) * Math.min(1, dt * 8);
    if (len > 0.01) {
      const nx = mx / len, nz = mz / len;
      this.pos.x += nx * this.speed * dt;
      this.pos.z += nz * this.speed * dt;
      const targetHeading = Math.atan2(nx, nz);
      let dh = targetHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
      this.walkPhase += dt * this.speed * 1.6;
    }
    // Keep inside the island (beach is walkable, sea is not).
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -268, 268);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -268, 292);
    city.resolveCollision(this.pos, 0.6);
    this.mesh.rotation.y = this.heading;
    const swing = Math.min(1, this.speed / PLAYER.walkSpeed) * 0.7;
    this.legs[0].rotation.x = Math.sin(this.walkPhase) * swing;
    this.legs[1].rotation.x = -Math.sin(this.walkPhase) * swing;
    this.arms[0].rotation.x = -Math.sin(this.walkPhase) * swing * 0.8;
    this.arms[1].rotation.x = Math.sin(this.walkPhase) * swing * 0.8;
  }

  enterCar(car) {
    this.inCar = car;
    car.driver = 'player';
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.inCar) return null;
    const car = this.inCar;
    car.driver = 'traffic';
    car.speed *= 0.3;
    this.inCar = null;
    // Step out to the left of the car.
    const side = car.heading + Math.PI / 2;
    this.pos.set(
      car.pos.x + Math.sin(side) * 2.4,
      0,
      car.pos.z + Math.cos(side) * 2.4,
    );
    this.heading = car.heading;
    this.mesh.visible = true;
    return car;
  }

  hurt(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) { this.health = Math.min(PLAYER.health, this.health + amount); }

  // Put the player back at a spawn point, on foot and healthy.
  reset(x, z) {
    if (this.inCar) this.exitCar();
    this.pos.set(x, 0, z);
    this.health = PLAYER.health;
    this.speed = 0;
  }
}

export { buildFigure };
