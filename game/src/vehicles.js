// Solmar Bay — vehicles: box-built cars, player driving, and traffic AI that
// cruises the road grid. Cars are simple meshes; driving is arcade physics.
import * as THREE from 'three';
import { CAR_COLORS, CAR_NAMES, CITY } from './config.js';

function buildCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62; body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), dark);
  cabin.position.set(0, 1.18, -0.25); cabin.castShadow = true;
  g.add(body); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0e10 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w); wheels.push(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    bar.position.set(0, 1.55, -0.25);
    g.add(bar);
    const bar2 = bar.clone();
    bar2.material = new THREE.MeshBasicMaterial({ color: 0x2266ff });
    bar2.position.x = 0; bar2.scale.x = 0.5; bar2.position.z = -0.25;
    g.add(bar2);
  }
  // Headlights
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const x of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.08), lightMat);
    l.position.set(x, 0.7, 2.21);
    g.add(l);
  }
  return { group: g, wheels };
}

export class Car {
  constructor(scene, color, name, isPolice = false) {
    const { group, wheels } = buildCarMesh(color, isPolice);
    this.mesh = group;
    this.wheels = wheels;
    this.name = name;
    this.isPolice = isPolice;
    this.speed = 0;            // m/s, forward
    this.heading = 0;          // radians, 0 = -z? we use +z forward via rotation
    this._targetHeading = 0;   // traffic AI steers toward this heading
    this.stolen = false;
    this.driver = null;        // 'player' | 'traffic' | 'police' | null
    this.maxSpeed = isPolice ? 30 : 24;
    scene.add(group);
  }

  get pos() { return this.mesh.position; }

  // Arcade drive step: throttle -1..1, steer -1..1.
  drive(dt, throttle, steer) {
    const accel = 16;
    this.speed += throttle * accel * dt;
    this.speed -= this.speed * 0.9 * dt;              // drag
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    this.speed = THREE.MathUtils.clamp(this.speed, -9, this.maxSpeed);
    if (Math.abs(this.speed) > 0.3) {
      this.heading += steer * 1.9 * dt * Math.sign(this.speed) * Math.min(1, Math.abs(this.speed) / 8);
    }
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.mesh.position.x += fx * this.speed * dt;
    this.mesh.position.z += fz * this.speed * dt;
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * dt / 0.36;
    for (const w of this.wheels) w.rotation.x += spin;
  }
}

export class Traffic {
  constructor(scene, city, count = 14) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    for (let i = 0; i < count; i++) {
      const color = CAR_COLORS[i % CAR_COLORS.length];
      const car = new Car(scene, color, CAR_NAMES[i % CAR_NAMES.length]);
      car.driver = 'traffic';
      this.placeOnRoad(car);
      car.heading = (Math.random() < 0.5 ? 0 : Math.PI / 2) + (Math.random() < 0.5 ? 0 : Math.PI);
      car.speed = 7 + Math.random() * 5;
      car._lane = (Math.random() < 0.5 ? -1 : 1) * 2.6;
      car._targetHeading = car.heading;
      this.cars.push(car);
    }
  }

  placeOnRoad(car) {
    const { half, block } = CITY;
    const lane = Math.floor(Math.random() * 10);
    const along = -half + Math.random() * half * 2;
    const roadAt = -half + lane * block + block / 2;
    if (Math.random() < 0.5) { car.pos.set(along, 0, roadAt); }
    else { car.pos.set(roadAt, 0, along); }
  }

  // Keep traffic flowing: follow the road grid, turn at intersections, avoid
  // piling into the player by slowing when something is right ahead.
  update(dt, playerPos, obstacles) {
    const { half, block } = CITY;
    for (const car of this.cars) {
      if (car.driver !== 'traffic' || car.parked) continue;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      // Look ahead for a slowdown.
      let blocked = false;
      for (const o of obstacles) {
        const dx = o.x - car.pos.x, dz = o.z - car.pos.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
      }
      const target = blocked ? 0 : 9 + (car._cruise || 0);
      car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
      // At an intersection, sometimes turn left/right to stay on the grid.
      if (car._targetHeading === undefined) car._targetHeading = car.heading;
      const nearX = Math.abs(((car.pos.x + half) % block) - block / 2) < 3;
      const nearZ = Math.abs(((car.pos.z + half) % block) - block / 2) < 3;
      if ((nearX || nearZ) && Math.random() < dt * 0.25) {
        car._targetHeading = car.heading + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      }
      let dh = car._targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += THREE.MathUtils.clamp(dh, -1.6 * dt, 1.6 * dt);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt / 0.36;
      for (const w of car.wheels) w.rotation.x += spin;
      // Wrap around the city edge instead of driving into the sea.
      if (Math.abs(car.pos.x) > half + 20 || Math.abs(car.pos.z) > half + 20) {
        this.placeOnRoad(car);
      }
      this.city.resolveCollision(car.pos, 2.2);
    }
  }

  nearestParked(pos, maxDist = 6) {
    let best = null, bestD = maxDist;
    for (const car of this.cars) {
      if (car.driver !== 'traffic') continue;
      const d = car.pos.distanceTo(pos);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  // A few extra parked cars near the spawn so the first mission is easy.
  addParked(scene, spots) {
    for (const [x, z, heading] of spots) {
      const car = new Car(scene, CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
        CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)]);
      car.driver = 'traffic';
      car.parked = true;
      car.pos.set(x, 0, z);
      car.heading = heading;
      car._targetHeading = heading;
      car.mesh.rotation.y = heading;
      car.speed = 0;
      this.cars.push(car);
    }
  }
}
