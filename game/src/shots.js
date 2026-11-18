// Solmar Bay — deterministic screenshot staging (?shot=...).
// Each scene places the player, cars and police so the frame is composed and
// readable, then lets the renderer settle before the screenshot is taken.
export function stageShot(shot, game) {
  const { player, traffic, police, combat, missions, hud } = game;
  const set = (x, z, heading, yaw) => {
    player.pos.set(x, 0, z);
    player.heading = heading;
    player.yaw = yaw;
    player.mesh.rotation.y = heading;
  };
  if (shot === 'start') {
    return { mode: 'title' };
  }
  if (shot === 'street') {
    set(0, 26, Math.PI * 0.85, 0.4);
    traffic.cars[0].pos.set(6, 0, 8);
    traffic.cars[0].heading = Math.PI / 2;
    traffic.cars[1].pos.set(-10, 0, 14);
    traffic.cars[1].heading = -Math.PI / 2;
    hud.setObjective('SOLMAR BAY', 'Explore the city — steal a car, run a job, dodge the PD.');
    return { mode: 'play', camYaw: 0.4 };
  }
  if (shot === 'mission') {
    missions.start(2);
    set(-185, -160, -2.3, 0.83);
    combat.spawnGang({ x: -210, z: -190 }, 5);
    police.setStars(2);
    hud.setObjective('3 — Dockside Showdown',
      'Take out 5 Coral Kings at the docks. Click to shoot, F to punch.');
    return { mode: 'play', camYaw: 0.83 };
  }
  // Default / 'chase': the cover shot — driving fast with police behind.
  const car = traffic.cars[0];
  car.pos.set(0, 0, 60);
  car.heading = 0;
  car.speed = 18;
  player.enterCar(car);
  police.setStars(3);
  police.spawnCarNear(car.pos);
  police.spawnCarNear(car.pos);
  const cop = police.cars[0];
  cop.pos.set(-6, 0, 82);
  cop.heading = 0;
  const cop2 = police.cars[1];
  cop2.pos.set(7, 0, 74);
  cop2.heading = 0;
  missions.start(0);
  hud.setObjective('1 — First Wheels', 'Drive to Rico’s garage (yellow marker) on Marina Row.');
  return { mode: 'play', chaseCar: car, camYaw: Math.PI };
}
