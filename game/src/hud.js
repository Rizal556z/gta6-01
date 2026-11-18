// Solmar Bay — HUD: cash, health, wanted stars, objective text, hints, toasts,
// and the circular minimap drawn on a 2D canvas.
import { CITY, MISSIONS } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      cash: document.getElementById('cash'),
      health: document.getElementById('healthfill'),
      stars: document.getElementById('stars'),
      objTitle: document.getElementById('objTitle'),
      objText: document.getElementById('objText'),
      speedo: document.getElementById('speedo'),
      weapon: document.getElementById('weapon'),
      hint: document.getElementById('hint'),
      toast: document.getElementById('toast'),
      crosshair: document.getElementById('crosshair'),
      damage: document.getElementById('damage'),
      minimap: document.getElementById('minimap'),
    };
    this.map = this.el.minimap.getContext('2d');
    this.toastTimer = null;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setCash(n) { this.el.cash.textContent = '$' + Math.round(n).toLocaleString('en-US'); }
  setHealth(h) { this.el.health.style.width = Math.max(0, h) + '%'; }
  setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="${i < n ? '' : 'off'}">★</span>`;
    this.el.stars.innerHTML = s;
  }
  setObjective(title, text) {
    this.el.objTitle.textContent = title;
    this.el.objText.textContent = text;
  }
  setSpeed(kmh, inCar) {
    this.el.speedo.textContent = inCar ? Math.round(kmh) + ' km/h' : '';
    this.el.crosshair.classList.toggle('hidden', inCar);
  }
  setWeapon(name, ammo) {
    this.el.weapon.textContent = `🔫 ${name} \u00A0${ammo}`;
  }
  setHint(text) { this.el.hint.textContent = text; }
  flashDamage() {
    this.el.damage.style.opacity = '1';
    setTimeout(() => { this.el.damage.style.opacity = '0'; }, 140);
  }

  toast(title, sub) {
    this.el.toast.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    this.el.toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.add('hidden'), 3200);
  }

  // Top-down map: roads, sea, marker, player arrow, cars, cops, enemies.
  drawMinimap(world) {
    const g = this.map;
    const S = 190, C = S / 2;
    const scale = S / (CITY.half * 2 + 60);
    const toMap = (x, z) => [C + x * scale, C + z * scale];
    g.clearRect(0, 0, S, S);
    // Clip to the circle.
    g.save();
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.clip();
    // Ground + sea.
    g.fillStyle = '#14384a'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#2f6b4f';
    const [gx0, gy0] = toMap(-CITY.half, -CITY.half);
    g.fillRect(gx0, gy0, CITY.half * 2 * scale, CITY.half * 2 * scale);
    g.fillStyle = '#1e7fa8';
    g.fillRect(0, C + CITY.seaZ * scale, S, S);
    // Roads.
    g.strokeStyle = '#3a3f46'; g.lineWidth = 5;
    const n = Math.floor((CITY.half * 2) / CITY.block);
    for (let i = 0; i <= n; i++) {
      const p = -CITY.half + i * CITY.block;
      const [x1, y1] = toMap(-CITY.half, p);
      const [x2, y2] = toMap(CITY.half, p);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const [x3, y3] = toMap(p, -CITY.half);
      const [x4, y4] = toMap(p, CITY.half);
      g.beginPath(); g.moveTo(x3, y3); g.lineTo(x4, y4); g.stroke();
    }
    // Mission marker.
    if (world.marker) {
      const [mx, my] = toMap(world.marker.x, world.marker.z);
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(mx, my, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffd23f'; g.lineWidth = 2;
      g.beginPath(); g.arc(mx, my, 11, 0, Math.PI * 2); g.stroke();
    }
    // Enemies (red), police (blue), traffic (white).
    const dot = (x, z, color, r) => {
      const [px, py] = toMap(x, z);
      g.fillStyle = color;
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    };
    for (const e of world.enemies) dot(e.pos.x, e.pos.z, '#ff4444', 3);
    for (const c of world.policeCars) dot(c.pos.x, c.pos.z, '#4499ff', 3.5);
    for (const c of world.traffic) dot(c.pos.x, c.pos.z, 'rgba(255,255,255,0.75)', 2.5);
    // Player arrow, rotated to heading.
    const [px, py] = toMap(world.player.x, world.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(world.heading);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(-5.5, 6); g.closePath();
    g.fill();
    g.restore();
    g.restore();
    // North tick.
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px sans-serif';
    g.textAlign = 'center';
    g.fillText('N', C, 12);
  }

  missionListHtml(index, doneIds) {
    return MISSIONS.map((m, i) => {
      const cls = doneIds.includes(m.id) ? 'done' : (i === index ? 'active' : 'locked');
      const mark = doneIds.includes(m.id) ? '✓ ' : (i === index ? '▶ ' : '· ');
      return `<div class="${cls}">${mark}${m.name} — ${m.brief}</div>`;
    }).join('');
  }
}
