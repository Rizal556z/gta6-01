// Solmar Bay — missions: a scripted chain of steps with a glowing ground marker,
// a beacon of light, progression and cash rewards.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export class MissionManager {
  constructor(scene, onEvent) {
    this.scene = scene;
    this.onEvent = onEvent;   // (type, payload) — 'complete' | 'step' | 'toast'
    this.index = 0;
    this.stepIndex = 0;
    this.done = [];
    this.active = false;
    this.marker = null;       // { mesh, beacon, pos, radius }
    this.escapeTimer = 0;
  }

  get current() { return MISSIONS[this.index] || null; }
  get step() { return this.current ? this.current.steps[this.stepIndex] : null; }
  get finished() { return this.index >= MISSIONS.length; }

  // "Mission 2 of 4" style progress for the pause menu.
  status() {
    return {
      index: Math.min(this.index + 1, MISSIONS.length),
      total: MISSIONS.length,
      done: this.done.length,
    };
  }

  start(index = 0) {
    this.index = index;
    this.stepIndex = 0;
    this.done = MISSIONS.slice(0, index).map((m) => m.id);
    this.active = true;
    this.showStep();
    if (this.current?.onStartWanted) this.onEvent('wanted', this.current.onStartWanted);
  }

  // Move to the next step or mission. Returns the reward paid (0 if none).
  advance() {
    const m = this.current;
    if (!m) return 0;
    this.stepIndex++;
    if (this.stepIndex >= m.steps.length) {
      this.done.push(m.id);
      this.index++;
      this.stepIndex = 0;
      this.onEvent('complete', m);
      if (this.current) {
        this.showStep();
        if (this.current.onStartWanted) this.onEvent('wanted', this.current.onStartWanted);
      } else {
        this.clearMarker();
        this.active = false;
        this.onEvent('alldone', null);
      }
      return m.reward;
    }
    this.showStep();
    return 0;
  }

  showStep() {
    this.clearMarker();
    const s = this.step;
    if (!s) return;
    this.onEvent('step', { mission: this.current, step: s });
    if (s.kind === 'goto' || s.kind === 'clear') {
      this.placeMarker(new THREE.Vector3(s.pos[0], 0, s.pos[2]), s.radius || 12);
    }
  }

  placeMarker(pos, radius) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 1.2, radius, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.12, pos.z);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(pos.x, 45, pos.z);
    this.scene.add(ring); this.scene.add(beam);
    this.marker = { ring, beam, pos, radius };
  }

  clearMarker() {
    if (!this.marker) return;
    this.scene.remove(this.marker.ring);
    this.scene.remove(this.marker.beam);
    this.marker = null;
  }

  update(dt, state) {
    if (!this.active || !this.step) return;
    const s = this.step;
    // Pulse the marker ring.
    if (this.marker) {
      const t = performance.now() / 400;
      this.marker.ring.material.opacity = 0.55 + Math.sin(t) * 0.3;
    }
    if (s.kind === 'goto') {
      const p = state.playerPos;
      const dx = p.x - s.pos[0], dz = p.z - s.pos[2];
      if (Math.hypot(dx, dz) < s.radius) {
        const reward = this.advance();
        state.onArrive?.(reward);
      }
    } else if (s.kind === 'getcar') {
      if (state.inCar) {
        const reward = this.advance();
        state.onArrive?.(reward);
      }
    } else if (s.kind === 'clear') {
      if (state.enemiesLeft === 0) {
        const reward = this.advance();
        state.onArrive?.(reward);
      }
    } else if (s.kind === 'escape') {
      if (state.wanted === 0) {
        this.escapeTimer += dt;
        if (this.escapeTimer > 2) {
          const reward = this.advance();
          state.onArrive?.(reward);
        }
      } else {
        this.escapeTimer = 0;
      }
    }
  }

  markerPos() { return this.marker ? this.marker.pos : null; }
}
