// SOLMAR BAY — an original open-world crime game in the browser.
// Third-person on foot and by car, traffic, pedestrians, police, missions,
// combat, minimap, save game and synthesized sound. No external assets.
import * as THREE from 'three';
import { CITY, MISSIONS } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { City } from './city.js';
import { Player } from './player.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const sounds = new SoundBank();
const input = new Input(canvas);
const city = new City(scene);
const player = new Player(scene);
const traffic = new Traffic(scene, city, 14);
traffic.addParked(scene, [[8, 26, 0], [-14, 30, Math.PI], [24, -6, Math.PI / 2], [-30, 52, 0]]);
const peds = new Pedestrians(scene, city, 26);
const police = new Police(scene, city);
const combat = new Combat(scene, city);
const hud = new Hud();

let mode = 'title';            // title | play | pause | busted | wasted
let camYaw = 0.4, camPitch = 0.32, camDist = 9;
let shootCooldown = 0, punchCooldown = 0, saveTimer = 0, stepTimer = 0;
let missionRewardPending = 0;
let shotMode = null;

const missions = new MissionManager(scene, (type, payload) => {
  if (type === 'complete') {
    missionRewardPending = payload.reward;
    player.cash += payload.reward;
    sounds.missionDone();
    hud.toast('MISSION COMPLETE', `${payload.name} — +$${payload.reward}`);
    writeSave(snapshot());
  } else if (type === 'step') {
    hud.setObjective(payload.mission.name, payload.step.text);
  } else if (type === 'wanted') {
    police.addCrime(payload);
    hud.toast('HEAT IS ON', 'The Solmar PD is looking for you.');
  } else if (type === 'alldone') {
    hud.toast('SOLMAR BAY IS YOURS', 'Every job done. Free roam — the city is yours, Milo.');
  }
});

function snapshot() {
  return {
    cash: player.cash,
    missionIndex: missions.index,
    missionsDone: missions.done,
    health: player.health,
    pos: player.pos,
  };
}

// ---------- Screens ----------
const $ = (id) => document.getElementById(id);
const saved = loadSave();
if (saved) $('continueBtn').classList.remove('hidden');

function startGame(fromSave) {
  sounds.ensure();
  sounds.startMusic();
  $('startScreen').classList.add('hidden');
  $('bustedScreen').classList.add('hidden');
  $('wastedScreen').classList.add('hidden');
  hud.show();
  mode = 'play';
  if (fromSave && saved) {
    player.cash = saved.cash ?? 150;
    player.health = saved.health ?? 100;
    player.pos.set(saved.pos?.[0] ?? 0, 0, saved.pos?.[1] ?? 40);
    missions.start(Math.min(saved.missionIndex ?? 0, MISSIONS.length - 1));
    hud.toast('WELCOME BACK', 'Save loaded — the city kept your spot warm.');
  } else {
    player.cash = 150;
    player.health = 100;
    player.pos.set(0, 0, 40);
    missions.start(0);
  }
  hud.setCash(player.cash);
  hud.setHealth(player.health);
  hud.setWeapon('Pistol', '∞');
  hud.setObjective(missions.current ? missions.current.name : 'SOLMAR BAY',
    missions.step ? missions.step.text : 'Free roam — the city is yours.');
}
$('playBtn').addEventListener('click', () => startGame(false));
$('continueBtn').addEventListener('click', () => startGame(true));
$('resumeBtn').addEventListener('click', () => {
  $('pauseMenu').classList.add('hidden');
  sounds.setMasterVolume(0.5);
  mode = 'play';
});
$('saveBtn').addEventListener('click', () => {
  writeSave(snapshot());
  hud.toast('SAVED', 'Progress saved to this browser.');
});
$('quitBtn').addEventListener('click', () => {
  writeSave(snapshot());
  $('pauseMenu').classList.add('hidden');
  $('startScreen').classList.remove('hidden');
  hud.hide();
  mode = 'title';
});
$('bustedBtn').addEventListener('click', () => { $('bustedScreen').classList.add('hidden'); respawn(); });
$('wastedBtn').addEventListener('click', () => { $('wastedScreen').classList.add('hidden'); respawn(); });

function respawn() {
  police.reset();
  combat.clearEnemies();
  player.reset(0, 40);
  hud.setHealth(100);
  mode = 'play';
}

function endRun(kind) {
  mode = kind;
  sounds.busted();
  sounds.siren(false);
  sounds.setEngine(0, false);
  if (kind === 'busted') {
    const bail = Math.min(player.cash, 200);
    player.cash -= bail;
    $('bustedText').textContent = `The Solmar PD hauled you in. Bail cost you $${bail}.`;
    $('bustedScreen').classList.remove('hidden');
  } else {
    const bill = Math.min(player.cash, 150);
    player.cash -= bill;
    $('wastedText').textContent = `Milo went down in Solmar Bay. The hospital bill was $${bill}.`;
    $('wastedScreen').classList.remove('hidden');
  }
  hud.setCash(player.cash);
  document.exitPointerLock?.();
}

// ---------- Shooting ----------
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
function tryShoot() {
  if (shootCooldown > 0 || player.inCar) return;
  shootCooldown = 0.28;
  sounds.shoot();
  camera.getWorldPosition(_origin);
  camera.getWorldDirection(_dir);
  const hit = combat.shoot(_origin, _dir, 90, traffic.cars);
  if (hit) {
    police.addCrime(0.5);
    if (!hit.alive && missions.step?.kind === 'clear') {
      hud.toast('GANG MEMBER DOWN', `${combat.aliveCount()} Coral Kings left.`);
    }
  }
  peds.scare(player.pos, 22);
}

// ---------- Main loop ----------
// Manual frame timing (THREE.Clock is deprecated in this three.js release).
let lastNow = performance.now();
const camTarget = new THREE.Vector3();
let frame = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastNow) / 1000, 0.1);
  lastNow = now;
  frame++;

  if (mode === 'play') {
    // Pause / missions menu
    if (input.takePressed('KeyM') || input.takePressed('Escape')) {
      mode = 'pause';
      sounds.setMasterVolume(0.15);
      input.clearPressed();
      $('missionList').innerHTML = hud.missionListHtml(missions.index, missions.done);
      $('pauseMenu').classList.remove('hidden');
      document.exitPointerLock?.();
    }

    // Look
    const look = input.consumeLook();
    camYaw -= look.dx * 0.0032;
    camPitch = THREE.MathUtils.clamp(camPitch + look.dy * 0.0024, 0.05, 1.1);

    const inCar = player.inCar;
    const forward = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    if (inCar) {
      // In screenshot chase mode the car drives itself so the frame has motion.
      const autoThrottle = shotMode === 'chase' ? 1 : 0;
      const throttle = input.axis('KeyS', 'KeyW') + (input.down('Space') ? -0.8 : 0) + autoThrottle;
      const steer = -input.axis('KeyA', 'KeyD');
      const before = inCar.speed;
      inCar.drive(dt, throttle, steer);
      if (Math.abs(inCar.speed) > 20 && Math.abs(before - inCar.speed) > 8) sounds.crash();
      sounds.setEngine(Math.abs(inCar.speed) / inCar.maxSpeed, true);
      player.pos.copy(inCar.pos);
      camYaw = THREE.MathUtils.lerp(camYaw, inCar.heading + Math.PI, Math.min(1, dt * 1.2));
      if (input.takePressed('KeyE')) {
        player.exitCar();
        sounds.setEngine(0, false);
        hud.setHint('On foot — press E near a car to steal it.');
      }
      hud.setSpeed(Math.abs(inCar.speed) * 3.6, true);
    } else {
      sounds.setEngine(0, false);
      const mx = right.x * input.axis('KeyA', 'KeyD') + forward.x * input.axis('KeyS', 'KeyW');
      const mz = right.z * input.axis('KeyA', 'KeyD') + forward.z * input.axis('KeyS', 'KeyW');
      const running = input.down('ShiftLeft') || input.down('ShiftRight');
      player.updateOnFoot(dt, { x: mx, z: mz }, running, city);
      hud.setSpeed(0, false);
      // Footsteps
      stepTimer -= dt * player.speed;
      if (player.speed > 3 && stepTimer <= 0) { sounds.footstep(); stepTimer = 2.2; }
      // Enter a car
      if (input.takePressed('KeyE')) {
        const car = traffic.nearestParked(player.pos, 7);
        if (car) {
          player.enterCar(car);
          car.stolen = true;
          police.addCrime(1);
          sounds.horn();
          hud.setHint('Nice ride. W to drive, Space to brake, E to get out.');
          hud.toast('CAR STOLEN', `${car.name} — the PD noticed.`);
        }
      }
      // Punch
      if (input.takePressed('KeyF') && punchCooldown <= 0) {
        punchCooldown = 0.45;
        sounds.punch();
        const hit = combat.punch(player.pos, player.heading, traffic.cars, peds.list);
        if (hit) police.addCrime(0.5);
      }
      // Shoot
      if (input.consumeClick() || input.mouseDown) tryShoot();
    }
    shootCooldown -= dt;
    punchCooldown -= dt;

    // Crime: running over a pedestrian.
    if (inCar && Math.abs(inCar.speed) > 4) {
      const near = peds.nearest(inCar.pos, 2.6);
      if (near) {
        near.pos.y = -2; // knocked down out of the way
        police.addCrime(1);
        peds.scare(inCar.pos, 25);
        sounds.crash();
      }
    }

    // World updates
    city.update(dt, now / 1000);
    const obstacles = traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, speed: c.speed, pos: c.pos }));
    if (player.inCar) obstacles.push({ x: player.pos.x, z: player.pos.z, speed: player.inCar.speed, pos: player.pos });
    traffic.update(dt, player.pos, obstacles);
    peds.update(dt, traffic.cars);
    const busted = police.update(dt, player, player.inCar, sounds);
    combat.update(dt, player.pos, (hit) => {
      if (hit) {
        const died = player.hurt(8 + Math.random() * 8);
        hud.flashDamage();
        hud.setHealth(player.health);
        if (died) endRun('wasted');
      }
    });
    if (busted) { endRun('busted'); }

    // Missions
    missions.update(dt, {
      playerPos: player.pos,
      inCar: !!player.inCar,
      enemiesLeft: combat.aliveCount(),
      wanted: police.wanted,
      onArrive: (reward) => {
        if (reward > 0) { /* reward already added by the event handler */ }
        if (missions.step?.kind === 'clear') combat.clearEnemies();
        if (missions.current?.id === 'pickup' && missions.stepIndex === 1) sounds.pickup();
      },
    });
    // Spawn gang members when the docks mission step begins.
    if (missions.step?.kind === 'clear' && combat.aliveCount() === 0 && missions.index === 2 && missions.stepIndex === 0) {
      combat.spawnGang({ x: -210, z: -190 }, 5);
    }

    // HUD
    hud.setCash(player.cash);
    hud.setStars(police.wanted);
    const nearCar = !player.inCar && traffic.nearestParked(player.pos, 7);
    if (nearCar) hud.setHint(`Press E to steal the ${nearCar.name}`);
    else if (!player.inCar && !hud.el.hint.textContent.includes('On foot')) hud.setHint('');
    hud.drawMinimap({
      player: player.pos,
      heading: player.inCar ? player.inCar.heading + Math.PI : player.heading,
      marker: missions.markerPos(),
      enemies: combat.enemies.filter((e) => e.alive),
      policeCars: police.cars,
      traffic: traffic.cars,
    });

    // Autosave every 30s.
    saveTimer += dt;
    if (saveTimer > 30) { saveTimer = 0; writeSave(snapshot()); }

    // Camera: third-person chase behind the player / car.
    const focus = player.inCar ? player.inCar.pos : player.pos;
    const back = player.inCar
      ? new THREE.Vector3(-Math.sin(player.inCar.heading), 0, -Math.cos(player.inCar.heading))
      : new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const dist = player.inCar ? 13 : 9.5;
    const height = player.inCar ? 5.0 : 3.8;
    camTarget.copy(focus).addScaledVector(back, dist);
    camTarget.y = height;
    camera.position.lerp(camTarget, Math.min(1, dt * 6));
    camera.lookAt(focus.x, (player.inCar ? 1.6 : 1.5), focus.z);
  }

  renderer.render(scene, camera);
}

// ---------- Screenshot staging ----------
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  const game = { player, traffic, police, combat, missions, hud };
  const staged = stageShot(shot, game);
  if (staged.mode === 'title') {
    mode = 'title';
    hud.hide();
    // Frame the skyline behind the title card.
    camera.position.set(30, 26, 150);
    camera.lookAt(0, 12, -60);
  } else {
    $('startScreen').classList.add('hidden');
    hud.show();
    mode = 'play';
    shotMode = shot;
    if (staged.camYaw !== undefined) camYaw = staged.camYaw;
    if (staged.chaseCar) {
      // Keep the chase car rolling so the cover shot has motion blur feel.
      staged.chaseCar.speed = 18;
    }
    // Let the world run a few frames so traffic/police settle into frame.
    camera.position.set(0, 5, 90);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
