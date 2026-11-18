// Solmar Bay — wanted level and the Solmar PD: patrol cars that chase and ram,
// foot officers who chase and try to arrest you. Stars decay when you lie low.
import * as THREE from 'three';
import { Car } from './vehicles.js';
import { buildFigure } from './player.js';
import { WANTED, CITY } from './config.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.stars = 0;
    this.heat = 0;              // 0..1, builds while crimes are witnessed
    this.cars = [];
    this.officers = [];
    this.bustedTimer = 0;       // officer contact time while on foot
    this.spawnTimer = 0;
  }

  get wanted() { return Math.round(this.stars); }

  addCrime(amount) {
    this.stars = Math.min(WANTED.maxStars, this.stars + amount);
    this.heat = 1;
  }

  setStars(n) { this.stars = THREE.MathUtils.clamp(n, 0, WANTED.maxStars); }

  // Full reset: clear the heat, the stars and every unit on the street.
  reset() {
    this.setStars(0);
    this.heat = 0;
    this.bustedTimer = 0;
    this.removeAll();
  }

  spawnCarNear(pos) {
    const car = new Car(this.scene, 0x1c2733, 'SPD Interceptor', true);
    car.driver = 'police';
    const angle = Math.random() * Math.PI * 2;
    const spot = this.city.nearestRoadPoint(
      pos.x + Math.sin(angle) * 55, pos.z + Math.cos(angle) * 55);
    car.pos.set(spot.x, 0, spot.z);
    car.heading = Math.atan2(pos.x - spot.x, pos.z - spot.z);
    car.mesh.rotation.y = car.heading;
    this.cars.push(car);
    return car;
  }

  spawnOfficerNear(pos) {
    const fig = buildFigure(0x1c3d6e, 0xd9a066);
    // Officer cap + badge
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x0e1c30 }));
    cap.position.y = 1.96;
    fig.group.add(cap);
    const o = {
      mesh: fig.group, legs: [fig.legL, fig.legR],
      pos: fig.group.position, speed: WANTED.copFootSpeed,
      phase: 0, arrest: 0,
    };
    o.pos.set(pos.x + (Math.random() - 0.5) * 30, 0, pos.z + (Math.random() - 0.5) * 30);
    this.scene.add(fig.group);
    this.officers.push(o);
    return o;
  }

  removeAll() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cars = [];
    this.officers = [];
  }

  update(dt, player, playerCar, sounds) {
    const targetPos = playerCar ? playerCar.pos : player.pos;
    const wanted = this.wanted;

    // Decay: stars fade when the player stays out of trouble.
    if (wanted > 0) {
      this.heat = Math.max(0, this.heat - dt * 0.12);
      if (this.heat <= 0) this.stars = Math.max(0, this.stars - WANTED.decayPerSec * dt);
    }

    // Keep the right number of units on the street.
    const wantCars = wanted >= 2 ? Math.min(3, wanted - 1) : 0;
    const wantOfficers = wanted >= 1 ? Math.min(3, wanted) : 0;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (this.cars.length < wantCars) this.spawnCarNear(targetPos);
      if (this.officers.length < wantOfficers) this.spawnOfficerNear(targetPos);
      this.spawnTimer = 1.2;
    }
    // Despawn the surplus when the heat drops.
    while (this.cars.length > wantCars) this.scene.remove(this.cars.pop().mesh);
    while (this.officers.length > wantOfficers) this.scene.remove(this.officers.pop().mesh);

    sounds.siren(wanted >= 2 && (this.cars.length > 0 || this.officers.length > 0));

    // Police cars: chase the player's position, ram the player's car.
    for (const car of this.cars) {
      const dx = targetPos.x - car.pos.x, dz = targetPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += THREE.MathUtils.clamp(dh, -2.2 * dt, 2.2 * dt);
      const speed = dist > 40 ? WANTED.copCarSpeed : WANTED.copCarSpeed * 0.85;
      car.speed += (speed - car.speed) * Math.min(1, dt * 1.5);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt / 0.36;
      for (const w of car.wheels) w.rotation.x += spin;
      this.city.resolveCollision(car.pos, 2.2);
      // Ram: shove the player's car and slow it a little.
      if (playerCar && dist < 4.2) {
        playerCar.speed *= 0.92;
        playerCar.pos.x += (dx / dist) * -0.4;
        playerCar.pos.z += (dz / dist) * -0.4;
        if (Math.random() < dt * 2) sounds.crash();
      }
    }

    // Foot officers: run at the player; contact for 2s = arrested.
    let touching = false;
    for (const o of this.officers) {
      const dx = player.pos.x - o.pos.x, dz = player.pos.z - o.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (playerCar) {
        // Officers wait at the roadside when the player is driving.
        o.phase += dt * 5;
        continue;
      }
      o.mesh.rotation.y = Math.atan2(dx, dz);
      o.pos.x += (dx / dist) * o.speed * dt;
      o.pos.z += (dz / dist) * o.speed * dt;
      o.phase += dt * 9;
      o.legs[0].rotation.x = Math.sin(o.phase) * 0.8;
      o.legs[1].rotation.x = -Math.sin(o.phase) * 0.8;
      this.city.resolveCollision(o.pos, 0.6);
      if (dist < 1.6) touching = true;
    }
    if (touching && wanted > 0 && !playerCar) {
      this.bustedTimer += dt;
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    return this.bustedTimer > 2; // true => busted
  }
}
