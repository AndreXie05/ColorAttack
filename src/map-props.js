import * as THREE from "three";
import { PAL, PAINTS } from "./game-config.js";

/* ============================================================
   5. ADEREÇOS (objetos grandes; os pequenos não têm colisão)
   ============================================================ */
export const Props = {
  tree(b, x, z, scale = 1.35, leaf = 0x35c75a) {
    b.begin(x, z);
    b.cyl(0, 0, 0, 0.6 * scale, 3.4 * scale, 0x8a5a2b, 0.42 * scale);
    b.sphere(0, 4.6 * scale, 0, 2.5 * scale, leaf);
    b.sphere(1.5 * scale, 3.8 * scale, 0.7 * scale, 1.6 * scale, 0x2fb34e);
    b.sphere(-1.3 * scale, 4.0 * scale, -0.8 * scale, 1.5 * scale, 0x45d86a);
    b.solidCircle(0, 0, 0.85 * scale, 9);
    b.end();
  },
  bench(b, x, z, ry = 0, wood = 0xe8a33d) {
    b.begin(x, z, ry, 0, 1.5);
    b.box(0, 0.65, 0, 3.4, 0.25, 1.0, wood);
    b.box(0, 0.9, -0.45, 3.4, 0.9, 0.2, wood);
    b.box(-1.5, 0, 0, 0.25, 0.65, 0.9, 0x555a66);
    b.box( 1.5, 0, 0, 0.25, 0.65, 0.9, 0x555a66);
    b.solid(0, 0, 3.4, 1.1, 1.2);
    b.end();
  },
  swing(b, x, z, ry = 0) {
    b.begin(x, z, ry, 0, 1.4);
    for (const sx of [-3, 3]) {
      b.box(sx, 0, -0.8, 0.4, 4.2, 0.4, PAL.red);
      b.box(sx, 0, 0.8, 0.4, 4.2, 0.4, PAL.red);
      b.solid(sx, 0, 0.6, 2.0, 4.2);
    }
    b.cylAxis("x", 0, 4.1, 0, 0.25, 6.8, PAL.blue);
    for (const sx of [-1.2, 1.2]) {
      b.box(sx - 0.45, 1.0, 0, 0.05, 3.1, 0.05, 0x333333);
      b.box(sx + 0.45, 1.0, 0, 0.05, 3.1, 0.05, 0x333333);
      b.box(sx, 0.9, 0, 1.1, 0.12, 0.5, PAL.yellow);
    }
    b.end();
  },
  slide(b, x, z, ry = 0) {
    b.begin(x, z, ry, 0, 1.4);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) b.box(dx, 0, dz, 0.25, 2.6, 0.25, 0xffb300);
    b.box(0, 2.4, 0, 2.4, 0.2, 2.4, PAL.blue);
    for (const dx of [-0.6, 0.6]) b.box(dx, 0, -1.4, 0.1, 2.4, 0.12, 0xdddddd);
    for (let i = 0; i < 5; i++) b.box(0, 0.4 + i * 0.45, -1.4, 1.3, 0.1, 0.12, 0xdddddd);
    b.boxR(0, 1.3, 3.8, 1.6, 0.15, 5.67, PAL.red, 0.408);
    b.boxR(-0.85, 1.5, 3.8, 0.12, 0.45, 5.67, PAL.yellow, 0.408);
    b.boxR( 0.85, 1.5, 3.8, 0.12, 0.45, 5.67, PAL.yellow, 0.408);
    b.solid(0, 0, 2.6, 2.6, 3);
    b.solid(0, 3.8, 1.9, 5.2, 1.0);
    b.end();
  },
  picnic(b, x, z, ry = 0) {
    b.begin(x, z, ry, 0, 1.5);
    b.box(0, 1.0, 0, 4, 0.2, 1.8, 0xd9a05b);
    b.box(0, 0.5, -1.5, 4, 0.15, 0.6, 0xe8b46b);
    b.box(0, 0.5,  1.5, 4, 0.15, 0.6, 0xe8b46b);
    for (const sx of [-1.6, 1.6]) b.box(sx, 0, 0, 0.25, 1.0, 1.6, 0x6d4c41);
    b.solid(0, 0, 4.1, 3.6, 1.2);
    b.end();
  },
  hedge(b, x, z, w, d) {
    b.box(x, 0, z, w, 3.2, d, 0x28a745);
    b.box(x, 3.2, z, w * 0.96, 0.3, d * 0.9, 0x34c759);
    b.solid(x, z, w, d, 3.5);
  },
  ball(b, x, z, r, color) {
    b.sphere(x, r, z, r, color);
    b.torus(x, r, z, r * 0.98, r * 0.08, 0xffffff, Math.PI / 2);
    b.solidCircle(x, z, r, r * 2);
  },
  desk(b, x, z, ry = 0) {
    b.begin(x, z, ry, 0, 1.5);
    b.box(0, 0.95, 0, 2.2, 0.12, 1.3, 0xf2c36b);
    for (const sx of [-0.95, 0.95]) for (const sz of [-0.5, 0.5]) b.box(sx, 0, sz, 0.12, 0.95, 0.12, 0x7a5a2a);
    b.box(0, 0.45, 0.95, 0.9, 0.12, 0.7, PAL.blue);          // cadeira
    b.solid(0, 0.2, 2.2, 1.9, 1.1);
    b.end();
  },
  lockers(b, face, x, zs) {
    b.begin(x, 0);
    zs.forEach((z, i) => {
      b.box(0, 0, z, 1.2, 3.2, 1.1, PAINTS[i % PAINTS.length]);
      b.box(face * 0.62, 1.5, z + 0.3, 0.08, 0.5, 0.1, 0xffffff);
      b.box(face * 0.62, 2.7, z, 0.05, 0.3, 0.8, 0x2b2b3a);
      b.box(face * 0.62, 0.3, z, 0.05, 0.3, 0.8, 0x2b2b3a);
    });
    const z0 = zs[0] - 0.55, z1 = zs[zs.length - 1] + 0.55;
    b.solid(0, (z0 + z1) / 2, 1.2, z1 - z0, 3.2);
    b.end();
  },
  hoop(b, x, z, ry = 0) {
    b.begin(x, z, ry, 0, 1.25);
    b.cyl(0, 0, 0, 0.2, 4, 0x9e9e9e);
    b.box(0, 3.9, 0.4, 0.2, 0.2, 0.8, 0x9e9e9e);
    b.box(0, 3.2, 0.9, 2.2, 1.4, 0.12, 0xffffff);
    b.torus(0, 3.4, 1.35, 0.4, 0.05, PAL.orange, Math.PI / 2);
    b.solidCircle(0, 0, 0.5, 4.2);
    b.end();
  },
  planter(b, x, z) {
    b.begin(x, z, 0, 0, 1.3);
    b.cyl(0, 0, 0, 2.2, 0.8, 0xb5651d);
    b.disc(0, 0, 2.0, 0x5d4037, 0.82);
    b.solidCircle(0, 0, 2.3, 0.8);
    b.end();
    Props.tree(b, x, z, 1.0, 0x4cd964);
  },
  table(b, x, z, color) {                      // restaurante
    b.begin(x, z, 0, 0, 1.4);
    b.cyl(0, 0, 0, 0.35, 1.1, 0x90a4ae);
    b.cyl(0, 1.1, 0, 1.8, 0.15, color);
    b.disc(0.7, 0.2, 0.42, 0xffffff, 1.27);
    b.disc(-0.6, -0.4, 0.42, 0xffffff, 1.27);
    b.cyl(0, 1.25, 0.9, 0.2, 0.35, PAL.red);
    b.cyl(0, 4.4, 0, 0.9, 0.7, 0xffc107, 0.25);             // candeeiro suspenso
    b.cyl(0, 5.1, 0, 0.04, 2.5, 0x333333);
    b.sphere(0, 4.35, 0, 0.28, 0xfff3b0, { emissive: 0xffe066 });
    b.solidCircle(0, 0, 1.85, 1.3);
    b.end();
  },
  booth(b, x, z, ry, w) {                      // banco corrido (restaurante)
    b.begin(x, z, ry);
    b.box(0, 0, 0, w, 0.9, 1.6, 0xc62828);
    b.box(0, 0.9, 0, w, 0.25, 1.4, 0xef5350);
    b.box(0, 0.9, -0.85, w, 1.6, 0.3, 0xb71c1c);
    b.solid(0, -0.1, w, 1.9, 1.4);
    b.end();
  },
  counter(b, x, z, w, d, ry = 0) {             // balcão de cozinha
    b.begin(x, z, ry, 0, 1.2);
    b.box(0, 0, 0, w, 1.75, d, 0xb0bec5);
    b.box(0, 1.75, 0, w + 0.2, 0.15, d + 0.2, 0x78909c);
    b.solid(0, 0, w + 0.2, d + 0.2, 1.9);
    b.end();
  },
  pot(b, x, z, liquid) {                       // tacho gigante
    b.begin(x, z, 0, 0, 1.4);
    b.cyl(0, 0, 0, 1.5, 1.8, 0xcfd8dc);
    b.cyl(0, 1.8, 0, 1.62, 0.2, 0x37474f);
    b.disc(0, 0, 1.4, liquid, 1.95);
    b.box(-1.85, 1.2, 0, 0.5, 0.15, 0.3, 0x37474f);
    b.box( 1.85, 1.2, 0, 0.5, 0.15, 0.3, 0x37474f);
    b.solidCircle(0, 0, 1.8, 2.0);
    b.end();
  },
  stove(b, x, z) {
    b.begin(x, z, 0, 0, 1.3);
    b.box(0, 0, 0, 2.2, 1.8, 5, 0x546e7a);
    for (const sz of [-1.2, 1.2]) b.disc(0, sz, 0.55, 0x111111, 1.82);
    b.box(0, 4.6, 0, 2.4, 0.4, 5.2, 0x90a4ae);
    b.cyl(0, 5.0, 0, 0.5, 2.0, 0x90a4ae);
    b.solid(0, 0, 2.2, 5, 1.9);
    b.end();
  },
  fridge(b, x, z, color = 0xeceff1) {
    b.begin(x, z, 0, 0, 1.3);
    b.box(0, 0, 0, 2.4, 4.2, 2.4, color);
    b.box(0, 2.0, 0, 2.45, 0.08, 2.45, 0x90a4ae);
    b.solid(0, 0, 2.4, 2.4, 4.2);
    b.end();
  },
  mixer(b, x, z, color) {                      // máquina de batidos/sumos
    b.begin(x, z, 0, 0, 1.5);
    b.box(0, 0, 0, 2.2, 2.6, 2.2, 0x7e57c2);
    b.cyl(0, 2.6, 0, 0.9, 1.4, color, 0.7);
    b.sphere(0, 4.2, 0, 0.45, PAL.white);
    b.solid(0, 0, 2.2, 2.2, 4);
    b.end();
  },
  tank(b, x, z, color) {                       // depósito gigante da fábrica
    b.begin(x, z, 0, 0, 1.3);
    b.cyl(0, 0, 0, 3.2, 8, color);
    b.cyl(0, 1.8, 0, 3.3, 0.5, 0xffffff);
    b.cyl(0, 5.6, 0, 3.3, 0.5, 0xffffff);
    b.sphere(0, 8, 0, 3.2, color);
    b.box(3.3, 0, 0, 0.2, 8, 0.7, 0x9e9e9e);
    b.solidCircle(0, 0, 3.3, 8);
    b.end();
  },
  vat(b, x, z, liquid) {                       // cuba aberta com pá a rodar
    b.begin(x, z, 0, 0, 1.3);
    b.cyl(0, 0, 0, 2.6, 2.6, 0x455a64);
    b.cyl(0, 2.6, 0, 2.75, 0.2, 0x263238);
    b.disc(0, 0, 2.4, liquid, 2.7);
    const paddle = new THREE.Group();
    paddle.position.set(0, 2.8, 0);
    b.enter(paddle);
    b.box(0, 0, 0, 4, 0.15, 0.4, 0xeeeeee);
    b.cyl(0, 0, 0, 0.15, 2.6, 0xeeeeee);
    b.end();
    b.cur.add(paddle);
    b.updaters.push(dt => { paddle.rotation.y += dt * 1.2; });
    b.solidCircle(0, 0, 2.8, 2.6);
    b.end();
  },
  conveyor(b, x, z, len) {
    b.begin(x, z, 0, 0, 1.3);
    b.box(0, 0, 0, 3, 0.9, len, 0x37474f);
    b.box(0, 0.9, 0, 2.4, 0.1, len - 0.4, 0x212121);
    for (const sx of [-1.45, 1.45]) b.box(sx, 0, 0, 0.12, 1.1, len, PAL.yellow);
    const cans = [];
    for (let i = 0; i < 3; i++) cans.push(b.cyl(0, 1.0, 0, 0.45, 0.8, PAINTS[i * 2 % PAINTS.length]));
    const span = len - 1.2;
    b.updaters.push((dt, t) => {
      cans.forEach((c, i) => { c.position.z = -span / 2 + ((t * 1.5 + i * span / 3) % span); });
    });
    b.solid(0, 0, 3, len, 1.1);
    b.end();
  },
  crate(b, x, z, color) {                      // caixote com lata de tinta por cima
    b.begin(x, z, 0, 0, 1.5);
    b.box(0, 0, 0, 2.4, 2.2, 2.4, 0xc08a4a);
    b.box(0, 1.0, 0, 2.45, 0.15, 2.45, 0x8d6330);
    b.cyl(0, 2.2, 0, 0.7, 0.9, color);
    b.solid(0, 0, 2.4, 2.4, 2.2);
    b.end();
  },
  machine(b, x, z, ry = 0) {
    b.begin(x, z, ry, 0, 1.3);
    b.box(0, 0, 0, 4, 3, 3, 0x607d8b);
    b.box(-1.2, 1.6, 1.52, 0.5, 0.5, 0.1, PAL.red);
    b.box( 0,   1.6, 1.52, 0.5, 0.5, 0.1, PAL.yellow);
    b.box( 1.2, 1.6, 1.52, 0.5, 0.5, 0.1, PAL.blue);
    b.cyl(1.2, 3, -0.8, 0.5, 2.5, 0x455a64);
    b.solid(0, 0, 4, 3, 3);
    b.end();
  },
  ferrisWheel(b, x, z) {                       // roda gigante (gira)
    const hubY = 13.5, R = 10;
    b.begin(x, z);
    for (const dz of [-1.6, 1.6]) {
      b.boxR(-3, hubY / 2, dz, 0.5, 14.77, 0.5, PAL.red, 0, 0, -0.418);
      b.boxR( 3, hubY / 2, dz, 0.5, 14.77, 0.5, PAL.red, 0, 0,  0.418);
      b.solid(-5.9, dz, 1.2, 1.2, 14);
      b.solid( 5.9, dz, 1.2, 1.2, 14);
    }
    b.cylAxis("z", 0, hubY, 0, 0.9, 4.2, PAL.yellow);
    const wheel = new THREE.Group();
    wheel.position.set(0, hubY, 0);
    b.cur.add(wheel);
    b.enter(wheel);
    for (const dz of [-1.6, 1.6]) {
      b.torus(0, 0, dz, R, 0.35, PAL.blue);
      for (let i = 0; i < 4; i++) b.boxR(0, 0, dz, 0.25, R * 2, 0.25, 0xeeeeee, 0, 0, i * Math.PI / 4);
    }
    b.end();
    const cabins = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const cab = new THREE.Group();
      cab.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      wheel.add(cab);
      b.enter(cab);
      b.box(0, -0.2, 0, 0.12, 1.0, 0.12, 0x333333);
      b.box(0, -2.0, 0, 2.2, 1.3, 3.6, PAINTS[i % PAINTS.length]);
      b.box(0, -0.7, 0, 2.5, 0.25, 3.9, 0xffffff);
      b.end();
      cabins.push(cab);
    }
    b.updaters.push(dt => {
      wheel.rotation.z -= dt * 0.25;
      for (const c of cabins) c.rotation.z = -wheel.rotation.z;
    });
    b.end();
  },
  carousel(b, x, z) {
    b.begin(x, z, 0, 0, 1.2);
    b.cyl(0, 0, 0, 5, 0.5, 0xff7eb6);
    const spin = new THREE.Group();
    b.cur.add(spin);
    b.enter(spin);
    b.cyl(0, 0.5, 0, 0.5, 3.8, PAL.yellow);
    b.cyl(0, 4.3, 0, 6, 0.3, PAL.yellow);
    b.cyl(0, 4.6, 0, 5.8, 2.2, PAL.red, 0.1);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, px = Math.cos(a) * 3.4, pz = Math.sin(a) * 3.4;
      b.cyl(px, 0.5, pz, 0.1, 3.8, 0xffd54f);
      b.boxR(px, 1.7, pz, 0.8, 0.9, 1.6, PAINTS[i], 0, -a, 0);
      b.boxR(px, 2.3, pz, 0.5, 0.6, 0.6, 0xffffff, 0, -a, 0);
    }
    b.end();
    b.updaters.push(dt => { spin.rotation.y += dt * 0.6; });
    b.solidCircle(0, 0, 5.2, 4.5);
    b.end();
  },
  stall(b, x, z, ry, c1, c2) {                 // barraca de jogos
    b.begin(x, z, ry, 0, 1.4);
    b.box(0, 0, 0.6, 5, 1.2, 1.2, c1);
    b.box(0, 0, -0.9, 5, 4, 0.4, c2);
    for (const sx of [-2.4, 2.4]) b.box(sx, 0, 0.8, 0.2, 3.6, 0.2, 0xffffff);
    for (let i = 0; i < 5; i++) b.boxR(-2.2 + i * 1.1, 3.8, 0.4, 1.1, 0.15, 2.5, i % 2 ? c1 : 0xffffff, 0.25);
    b.solid(0, 0.1, 5.2, 2.6, 4);
    b.end();
  },
  tent(b, x, z, c1, c2) {                      // tenda de circo
    b.begin(x, z, 0, 0, 1.2);
    b.cyl(0, 0, 0, 5, 1.6, c1);
    b.cyl(0, 1.6, 0, 5, 1.6, 0xffffff);
    b.cyl(0, 3.2, 0, 5.6, 3.6, c2, 0.15);
    b.cyl(0, 6.8, 0, 0.08, 1.6, 0x333333);
    b.box(0.5, 7.6, 0, 1.0, 0.6, 0.05, PAL.yellow);
    b.solidCircle(0, 0, 5.1, 6);
    b.end();
  },
  balloons(b, x, z) {
    b.begin(x, z, 0, 0, 1.3);
    b.cyl(0, 0, 0, 0.1, 4, 0xffffff);
    PAINTS.forEach((c, i) => {
      const a = i * Math.PI / 3;
      b.sphere(Math.cos(a) * 0.8, 5.0 + (i % 2) * 0.5, Math.sin(a) * 0.8, 0.75, c);
    });
    b.end();
  },
  dropTower(b, x, z) {                         // torre de queda (anel sobe e desce)
    b.begin(x, z);
    b.cyl(0, 0, 0, 1.4, 17, PAL.blue);
    b.cyl(0, 0, 0, 2.2, 0.6, PAL.yellow);
    b.sphere(0, 17.4, 0, 1.2, PAL.red);
    const ring = new THREE.Group();
    b.cur.add(ring);
    b.enter(ring);
    b.cyl(0, 0, 0, 2.4, 0.6, PAL.orange);
    for (let i = 0; i < 4; i++) b.box(Math.cos(i * Math.PI / 2) * 2.2, -0.5, Math.sin(i * Math.PI / 2) * 2.2, 0.8, 0.5, 0.8, PAL.purple);
    b.end();
    b.updaters.push((dt, t) => { ring.position.y = 9 + Math.sin(t * 0.7) * 6; });
    b.solidCircle(0, 0, 1.6, 17);
    b.end();
  },
  flagPole(b, x, z) {
    b.begin(x, z, 0, 0, 1.3);
    b.cyl(0, 0, 0, 0.18, 9, 0xeeeeee);
    b.box(1.3, 7.8, 0, 2.4, 0.5, 0.06, PAL.red);
    b.box(1.3, 7.3, 0, 2.4, 0.5, 0.06, PAL.yellow);
    b.box(1.3, 6.8, 0, 2.4, 0.5, 0.06, PAL.blue);
    b.solidCircle(0, 0, 0.45, 9);
    b.end();
  },
};

