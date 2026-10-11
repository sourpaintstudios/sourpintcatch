import * as THREE from "three";
import { createAudio } from "./audio";
import { INITIAL_HUD, type Hud } from "./hud";
import {
  MPH_TO_MS,
  PARTNER_Z,
  POCKET_Z,
  clamp,
  clone,
  closingSpeed,
  dist,
  evaluateCatch,
  fly,
  integrate,
  mphFromG,
  qualityFrom,
  readSwing,
  selfTest,
  solveLaunch,
  type Sample,
  type V3,
} from "./physics";

export type CatchGame = {
  prime: () => void;
  allow: () => void;
  beginThrow: (fromPointer?: boolean) => void;
  endThrow: () => void;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
};

const BEST_KEY = "catch-best-streak";
const PARTNER: V3 = { x: 0, y: 1.28, z: PARTNER_Z };
const REST_Y = 1.16;
const STEP = 1 / 120;

type Puff = {
  sprite: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
};

export function mountGame(canvas: HTMLCanvasElement, onHud: (hud: Hud) => void): CatchGame {
  const problems = selfTest();
  if (problems.length) console.warn("catch physics", problems);

  const audio = createAudio();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
  } catch (err) {
    onHud({
      ...INITIAL_HUD,
      phase: "error",
      error: err instanceof Error ? err.message : "This screen couldn't start the field.",
    });
    return {
      prime() {},
      allow() {},
      beginThrow() {},
      endThrow() {},
      setMuted() {},
      dispose() {},
    };
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.55 : 2));
  renderer.setClearColor(0xe7b48a, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xe8b48a, 0.013);
  const camera = new THREE.PerspectiveCamera(64, 1, 0.06, 180);
  camera.position.set(0, 1.62, 0.85);
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const markV = new THREE.Vector3();
  let markEl: HTMLElement | null = null;

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const geom = <T extends THREE.BufferGeometry>(g: T) => {
    geos.push(g);
    return g;
  };
  const mat = <T extends THREE.Material>(m: T) => {
    mats.push(m);
    return m;
  };

  const leather = mat(
    new THREE.MeshStandardMaterial({ color: "#8d4b2b", roughness: 0.62, metalness: 0.04 }),
  );
  const pocketMat = mat(
    new THREE.MeshStandardMaterial({ color: "#5c301c", roughness: 0.78, metalness: 0 }),
  );
  const lace = mat(
    new THREE.MeshStandardMaterial({ color: "#f0e2cf", roughness: 0.45, metalness: 0.02 }),
  );
  const skin = mat(new THREE.MeshStandardMaterial({ color: "#c69068", roughness: 0.7 }));
  const shirt = mat(new THREE.MeshStandardMaterial({ color: "#243646", roughness: 0.8 }));
  const pants = mat(new THREE.MeshStandardMaterial({ color: "#2c261f", roughness: 0.86 }));
  const capMat = mat(new THREE.MeshStandardMaterial({ color: "#1a1612", roughness: 0.55 }));
  const wood = mat(new THREE.MeshStandardMaterial({ color: "#6d4c34", roughness: 0.88 }));
  const cactusMat = mat(new THREE.MeshStandardMaterial({ color: "#3e6846", roughness: 0.9 }));
  const mesaMat = mat(
    new THREE.MeshStandardMaterial({ color: "#6e5344", roughness: 1, flatShading: true }),
  );

  const sky = new THREE.Mesh(
    geom(new THREE.SphereGeometry(120, 24, 16)),
    mat(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        toneMapped: false,
        vertexShader: "varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: `
          precision mediump float;
          varying vec3 vP;
          void main() {
            vec3 dir = normalize(vP);
            float h = dir.y;
            vec3 hor = vec3(0.97, 0.66, 0.40);
            vec3 mid = vec3(0.78, 0.34, 0.18);
            vec3 top = vec3(0.13, 0.11, 0.24);
            vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h));
            col = mix(col, top, smoothstep(0.12, 0.78, h));
            float sun = pow(max(dot(dir, normalize(vec3(0.62, 0.18, 0.28))), 0.0), 36.0);
            col += vec3(1.0, 0.78, 0.46) * sun;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    ),
  );
  scene.add(sky);

  const grassTex = noiseTex("#74804a", 28, 24);
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(18, 18);
  texs.push(grassTex);
  const dirtTex = noiseTex("#c4a06a", 22, 12);
  dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
  dirtTex.repeat.set(6, 10);
  texs.push(dirtTex);

  const grass = new THREE.Mesh(
    geom(new THREE.CircleGeometry(70, 48)),
    mat(new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 })),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  const lane = new THREE.Mesh(
    geom(new THREE.PlaneGeometry(3.4, 26)),
    mat(new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1, metalness: 0 })),
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.012, -11);
  lane.receiveShadow = true;
  scene.add(lane);

  for (const [x, z, r] of [
    [0, 0.2, 2.4],
    [0, -21.2, 2.1],
  ] as const) {
    const disc = new THREE.Mesh(
      geom(new THREE.CircleGeometry(r, 24)),
      mat(new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 })),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.02, z);
    disc.receiveShadow = true;
    scene.add(disc);
  }

  const chalk = mat(
    new THREE.MeshBasicMaterial({ color: "#f4eadc", transparent: true, opacity: 0.35 }),
  );
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(geom(new THREE.BoxGeometry(0.04, 0.01, 16)), chalk);
    line.position.set(side * 0.9, 0.03, -6);
    scene.add(line);
  }

  for (let i = 0; i < 9; i++) {
    const post = new THREE.Mesh(geom(new THREE.BoxGeometry(0.08, 1.25, 0.08)), wood);
    post.position.set(-4 + i, 0.62, -24.3);
    post.castShadow = true;
    scene.add(post);
  }
  for (const y of [0.4, 0.78, 1.1]) {
    const rail = new THREE.Mesh(geom(new THREE.BoxGeometry(8.2, 0.055, 0.04)), wood);
    rail.position.set(0, y, -24.3);
    rail.castShadow = true;
    scene.add(rail);
  }

  const saguaro = (x: number, z: number, s: number) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(geom(new THREE.CylinderGeometry(0.16 * s, 0.2 * s, 2.8 * s, 7)), cactusMat);
    trunk.position.y = 1.4 * s;
    trunk.castShadow = true;
    g.add(trunk);
    const arm = new THREE.Mesh(geom(new THREE.CylinderGeometry(0.09 * s, 0.11 * s, 0.9 * s, 6)), cactusMat);
    arm.position.set(0.28 * s, 1.7 * s, 0);
    arm.rotation.z = Math.PI / 2.5;
    arm.castShadow = true;
    g.add(arm);
    g.position.set(x, 0, z);
    scene.add(g);
  };
  saguaro(-7.5, -14, 1);
  saguaro(9.2, -28, 1.35);

  for (const [x, z, w, h, d] of [
    [-28, -78, 34, 11, 16],
    [8, -90, 42, 16, 18],
    [36, -70, 28, 9, 14],
  ] as const) {
    const mesa = new THREE.Mesh(geom(new THREE.BoxGeometry(w, h, d)), mesaMat);
    mesa.position.set(x, h * 0.35, z);
    scene.add(mesa);
  }

  const hemi = new THREE.HemisphereLight(0xffd2a8, 0x3a2a1c, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb26b, 2.6);
  sun.position.set(16, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  sun.target.position.set(0, 0.5, -12);
  scene.add(sun.target);

  const playerMitt = makeMitt(geom, leather, pocketMat, lace, 1);
  camera.add(playerMitt);
  scene.add(camera);

  const fielder = new THREE.Group();
  fielder.position.set(0, 0, -22);
  const limb = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    fielder.add(mesh);
    return mesh;
  };
  limb(geom(new THREE.CapsuleGeometry(0.07, 0.5, 3, 6)), pants, -0.1, 0.48, 0);
  limb(geom(new THREE.CapsuleGeometry(0.07, 0.5, 3, 6)), pants, 0.1, 0.48, 0);
  limb(geom(new THREE.CapsuleGeometry(0.16, 0.38, 3, 8)), shirt, 0, 1.12, 0);
  limb(geom(new THREE.SphereGeometry(0.11, 14, 12)), skin, 0, 1.58, 0);
  const cap = limb(geom(new THREE.SphereGeometry(0.118, 14, 10)), capMat, 0, 1.64, 0.01);
  cap.scale.set(1, 0.72, 1);
  const brim = limb(geom(new THREE.BoxGeometry(0.16, 0.02, 0.12)), capMat, 0, 1.6, 0.12);
  brim.castShadow = true;
  const fielderMitt = makeMitt(geom, leather, pocketMat, lace, 0.62);
  fielderMitt.position.set(0.22, 1.2, 0.32);
  fielder.add(fielderMitt);
  scene.add(fielder);
  const mittHome = fielderMitt.position.clone();

  const ballTex = ballTexture();
  texs.push(ballTex);
  const ballMat = mat(
    new THREE.MeshStandardMaterial({
      map: ballTex,
      roughness: 0.42,
      metalness: 0.02,
      emissive: new THREE.Color("#ffd0a8"),
      emissiveIntensity: 0.15,
    }),
  );
  const ballMesh = new THREE.Mesh(geom(new THREE.SphereGeometry(0.037, 24, 16)), ballMat);
  ballMesh.castShadow = true;
  scene.add(ballMesh);

  const soft = softCircle();
  texs.push(soft);
  const shadow = new THREE.Mesh(
    geom(new THREE.CircleGeometry(0.28, 18)),
    mat(new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.3, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  scene.add(shadow);

  const trail: THREE.Sprite[] = [];
  for (let i = 0; i < 10; i++) {
    const sm = mat(
      new THREE.SpriteMaterial({
        map: soft,
        color: 0xf6f1e6,
        transparent: true,
        depthWrite: false,
        opacity: 0.22 * (1 - i / 12),
      }),
    );
    const s = new THREE.Sprite(sm);
    s.scale.setScalar(0.18 * (1 - i / 14));
    s.visible = false;
    scene.add(s);
    trail.push(s);
  }

  const puffs: Puff[] = [];
  for (let i = 0; i < 18; i++) {
    const sm = mat(
      new THREE.SpriteMaterial({
        map: soft,
        color: 0xe4d0b4,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    const s = new THREE.Sprite(sm);
    s.visible = false;
    scene.add(s);
    puffs.push({ sprite: s, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
  }

  const gemLight = new THREE.PointLight(0xf0c14a, 0, 3.2, 2);
  scene.add(gemLight);
  const ring = new THREE.Mesh(
    geom(new THREE.TorusGeometry(0.1, 0.012, 8, 28)),
    mat(
      new THREE.MeshBasicMaterial({
        color: 0xf0c14a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    ),
  );
  ring.visible = false;
  scene.add(ring);

  const motes: THREE.Sprite[] = [];
  const moteMat = mat(
    new THREE.SpriteMaterial({
      map: soft,
      color: 0xf0d2b0,
      transparent: true,
      depthWrite: false,
      opacity: 0.22,
    }),
  );
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(moteMat);
    s.position.set((Math.random() - 0.5) * 12, 0.5 + Math.random() * 2.2, -1 - Math.random() * 20);
    s.scale.setScalar(0.06 + Math.random() * 0.1);
    s.userData.seed = Math.random() * 10;
    scene.add(s);
    motes.push(s);
  }

  let allowed = false;
  let phase: Hud["phase"] = "idle";
  let charging = false;
  let stuck = false;
  let resolved = false;
  let streak = 0;
  let best = 0;
  try {
    best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    best = 0;
  }
  let catches = 0;
  let bannerId = 0;
  let banner = "";
  let bannerTone: Hud["bannerTone"] = "good";
  let flashId = 0;
  let mph: number | null = null;
  let quality = "";
  let peakLive = 0;
  let holdT = 0;
  let downT = 0;
  let backAge = 0;
  let outSpeed = 16;
  let throwJerk = 0;
  let chargeDy = 0;
  let chargeStart = 0;
  let sawDevice = false;
  let trauma = 0;
  let glovePunch = 0;
  let ringLife = 0;
  let fovKick = 0;
  let time = 0;
  let lookY = 1.35;
  let emitAcc = 0;
  let aimX = 0;
  let aimY = REST_Y;
  let aimOverride: { x: number; y: number } | null = null;
  let steerTouch = false;
  let spotX = 0;
  let spotY = REST_Y;
  let spotLive = false;
  let originX = 0;
  let originY = REST_Y;
  const ball: V3 = { x: 0, y: REST_Y, z: POCKET_Z };
  const vel: V3 = { x: 0, y: 0, z: 0 };
  const prev: V3 = { x: 0, y: REST_Y, z: POCKET_Z };
  const drawGlove: V3 = { x: 0, y: REST_Y, z: POCKET_Z };
  const samples: Sample[] = [];
  let haveOri = false;
  let beta = 60;
  let gamma = 0;
  let neutralBeta = 60;
  let neutralGamma = 0;
  let betaAtPress = 60;
  let lastOri = 0;
  const keys = new Set<string>();
  const pointers = new Set<number>();
  let chargePointer = false;
  let lastPX = 0;
  let lastPY = 0;
  let lastPT = 0;
  let haveP = false;
  let padWas = false;
  let last = performance.now();
  let acc = 0;
  let disposed = false;

  const tmp = new THREE.Vector3();

  function preferMotion() {
    return haveOri && !fine && performance.now() - lastOri < 1500;
  }

  function inputLabel() {
    if (preferMotion()) return "Tilt to the ball";
    return fine ? "Move to the ball" : "Drag to the ball";
  }

  function showBanner(text: string, tone: Hud["bannerTone"]) {
    banner = text;
    bannerTone = tone;
    bannerId += 1;
  }

  function liveTilt() {
    if (haveOri) return clamp((beta - betaAtPress) / 26, -1, 1);
    return clamp(-chargeDy / 240, -1, 1);
  }

  function coach(): string {
    if (phase === "charge") {
      const tilt = liveTilt();
      const age = (performance.now() - chargeStart) / 1000;
      if (age > 0.72) return "Let go. Holding longer won't lob it.";
      if (tilt > 0.28) return haveOri ? "Pushed forward. Let go to lob." : "Flicked up. Let go to lob.";
      if (tilt < -0.28 && haveOri) return "Other way. Push the top forward, like a lob.";
      if (peakLive >= 0.6) return haveOri ? "Let go. Push the top forward to lob." : "Let go. Flick up to lob.";
      return haveOri ? "Swing it forward and let go." : "Flick up and let go.";
    }
    if (phase === "idle") return catches === 0 ? "Swing it forward and let go. Like a lob." : "";
    if (phase === "out") return "On its way.";
    if (phase === "hold") return "Gold ring shows where to catch.";
    if (phase !== "back" || !spotLive) return "";
    const gap = Math.hypot(aimX - spotX, aimY - spotY);
    if (gap < 0.12) return "Hold still. That's the web.";
    if (gap < 0.42) return "Hold still. That's a catch.";
    return "Drag the mitt into the gold ring.";
  }

  function emit(dt: number, force = false) {
    emitAcc += dt;
    if (!force && emitAcc < 0.12) return;
    emitAcc = 0;
    onHud({
      phase,
      streak,
      best,
      gee: charging ? peakLive : null,
      mph,
      quality,
      meter: charging ? clamp(peakLive / 3, 0, 1) : 0,
      bannerId,
      banner,
      bannerTone,
      inputLabel: phase === "back" ? "" : inputLabel(),
      hint: coach(),
      flashId,
      error: "",
    });
  }

  function trimSamples() {
    const cutoff = performance.now() - 1600;
    let drop = 0;
    while (drop < samples.length && samples[drop].t < cutoff) drop++;
    if (drop) samples.splice(0, drop);
  }

  function pushSample(g: number, fromDevice: boolean) {
    if (fromDevice && !sawDevice) {
      samples.length = 0;
      sawDevice = true;
    }
    if (!fromDevice && sawDevice) return;
    peakLive = Math.max(peakLive, g);
    samples.push({ t: performance.now(), g });
    trimSamples();
  }

  function burst(x: number, y: number, z: number) {
    let spawned = 0;
    for (const p of puffs) {
      if (p.life > 0) continue;
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 1.6;
      p.vx = Math.cos(ang) * spd;
      p.vz = Math.sin(ang) * spd * 0.7;
      p.vy = 0.8 + Math.random() * 1.8;
      p.life = 0.28 + Math.random() * 0.22;
      p.max = p.life;
      p.sprite.visible = true;
      p.sprite.position.set(x, y, z);
      p.sprite.scale.setScalar(0.08 + Math.random() * 0.12);
      spawned++;
      if (spawned >= 14) break;
    }
  }

  function buzz(speed: number) {
    const ms = Math.round(80 + clamp(speed / 28, 0, 1) * 40);
    navigator.vibrate?.(ms);
  }

  function rememberBest() {
    if (streak > best) {
      best = streak;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch {
        /* ignore */
      }
    }
  }

  function playerCatch(gem: boolean, speed: number) {
    if (resolved) return;
    resolved = true;
    stuck = true;
    phase = "down";
    catches += 1;
    streak += gem ? 2 : 1;
    rememberBest();
    audio.whistleStop();
    audio.snap(gem ? 1 : 0.72 + clamp(speed / 30, 0, 0.28));
    buzz(speed);
    burst(drawGlove.x, drawGlove.y, drawGlove.z);
    trauma = reduce ? 0 : gem ? 0.62 : 0.4;
    glovePunch = 1;
    gemLight.position.set(drawGlove.x, drawGlove.y, drawGlove.z);
    if (gem) {
      gemLight.intensity = 7;
      flashId += 1;
      ring.position.set(drawGlove.x, drawGlove.y, drawGlove.z);
      ring.visible = true;
      ring.scale.setScalar(1);
      ringLife = 0.38;
      showBanner("Web gem", "gem");
    } else {
      gemLight.intensity = 1.4;
      showBanner("Caught", "good");
    }
    downT = gem ? 1.05 : 0.9;
    emit(0, true);
  }

  function playerMiss() {
    if (resolved) return;
    resolved = true;
    stuck = false;
    phase = "down";
    streak = 0;
    audio.whistleStop();
    audio.thud();
    showBanner("Missed", "bad");
    downT = 1;
    emit(0, true);
  }

  function playerShort() {
    if (resolved) return;
    resolved = true;
    stuck = false;
    phase = "down";
    audio.whistleStop();
    audio.thud();
    showBanner("Short", "bad");
    downT = 1.05;
    emit(0, true);
  }

  function releaseReturn() {
    const lateral = (Math.random() * 2 - 1) * (0.04 + throwJerk * 0.7);
    const lift = throwJerk * 0.45;
    const target = { x: lateral, y: 1.12 + lift, z: POCKET_Z };
    let speed = clamp(outSpeed * 0.78, 14.5, 20);
    let launch = solveLaunch(clone(PARTNER), target, speed, 0.32 + throwJerk * 0.85, 0.2);
    if (!launch.reached) {
      speed += 3;
      launch = solveLaunch(clone(PARTNER), target, speed, 0.4, 0.35);
    }
    ball.x = PARTNER.x;
    ball.y = PARTNER.y;
    ball.z = PARTNER.z;
    vel.x = launch.velocity.x;
    vel.y = launch.velocity.y;
    vel.z = launch.velocity.z;
    stuck = false;
    resolved = false;
    phase = "back";
    backAge = 0;
    audio.swoosh();
    audio.whistleStart();
    emit(0, true);
  }

  function resetIdle() {
    phase = "idle";
    stuck = false;
    resolved = false;
    charging = false;
    steerTouch = false;
    vel.x = vel.y = vel.z = 0;
    emit(0, true);
  }

  function finishThrow() {
    charging = false;
    const cutoff = performance.now() - 800;
    const recent = samples.filter((s) => s.t >= cutoff);
    const swing = readSwing(recent);
    samples.length = 0;
    sawDevice = false;
    if (!swing.ok) {
      const text = swing.reason === "soft" ? "Too soft" : swing.reason === "quick" ? "Too quick" : "Held too long";
      showBanner(text, "bad");
      phase = "idle";
      emit(0, true);
      return;
    }
    const tilt = liveTilt();
    const loft = clamp(swing.jerk * 0.85 + Math.max(0, tilt) * 0.45 - Math.max(0, -tilt) * 0.08, 0, 1);
    let mphValue = mphFromG(swing.peak);
    let desired = 0.16 + loft * 0.95;
    let missLimit = 0.7;
    const lob = tilt > 0.28;
    if (lob) {
      mphValue = Math.min(mphValue, 36 + (1 - tilt) * 4);
      desired = 1.05;
      missLimit = 1.45;
    }
    const speed = clamp(mphValue * MPH_TO_MS, 8, 34);
    const origin = { x: originX, y: originY, z: POCKET_Z };
    const target = {
      x: (Math.random() * 2 - 1) * 0.35 * swing.jerk,
      y: PARTNER.y,
      z: PARTNER.z,
    };
    const launch = solveLaunch(origin, target, speed, desired, missLimit);
    ball.x = origin.x;
    ball.y = origin.y;
    ball.z = origin.z;
    vel.x = launch.velocity.x;
    vel.y = launch.velocity.y;
    vel.z = launch.velocity.z;
    outSpeed = speed;
    throwJerk = swing.jerk;
    mph = Math.round(mphValue);
    quality = lob && launch.reached && launch.angle > 0.75 ? "Lob" : qualityFrom(swing.jerk, launch.reached);
    if (quality === "Lob") showBanner("Lob", "good");
    audio.swoosh();
    fovKick = 2.2;
    if (!launch.reached) {
      phase = "out";
      resolved = false;
      stuck = false;
      audio.whistleStart();
      emit(0, true);
      return;
    }
    phase = "out";
    resolved = false;
    stuck = false;
    audio.whistleStart();
    emit(0, true);
  }

  function beginThrow(fromPointer = false) {
    if (!allowed || charging || phase !== "idle") return;
    charging = true;
    chargePointer = fromPointer;
    steerTouch = false;
    phase = "charge";
    samples.length = 0;
    sawDevice = false;
    peakLive = 0;
    chargeDy = 0;
    chargeStart = performance.now();
    haveP = false;
    originX = aimX;
    originY = aimY;
    betaAtPress = beta;
    emit(0, true);
  }

  function endThrow() {
    if (!charging) return;
    finishThrow();
  }

  function setAimFromClient(cx: number, cy: number) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((cx - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointerNdc.y = -(((cy - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointerNdc, camera);
    const dir = raycaster.ray.direction;
    if (Math.abs(dir.z) < 1e-4) return;
    const t = (POCKET_Z - raycaster.ray.origin.z) / dir.z;
    if (t <= 0) return;
    aimX = clamp(raycaster.ray.origin.x + dir.x * t, -0.95, 0.95);
    aimY = clamp(raycaster.ray.origin.y + dir.y * t, 0.42, 2.45);
    aimOverride = null;
  }

  function applyAim(dt: number) {
    let nudged = false;
    const right =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const up =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    if (right || up) {
      aimX = clamp(aimX + right * 1.35 * dt, -0.95, 0.95);
      aimY = clamp(aimY + up * 1.15 * dt, 0.42, 2.45);
      nudged = true;
    }
    const pads = navigator.getGamepads?.();
    if (pads) {
      for (const pad of pads) {
        if (!pad) continue;
        let x = pad.axes[0] ?? 0;
        let y = pad.axes[1] ?? 0;
        const m = Math.hypot(x, y);
        if (m < 0.18) {
          x = 0;
          y = 0;
        } else {
          const s = (m - 0.18) / (0.82 * m);
          x *= s;
          y *= s;
        }
        if (x || y) {
          aimX = clamp(aimX + x * 1.45 * dt, -0.95, 0.95);
          aimY = clamp(aimY - y * 1.2 * dt, 0.42, 2.45);
          nudged = true;
        }
        const pressed = !!pad.buttons[0]?.pressed;
        if (pressed && !padWas) beginThrow();
        if (!pressed && padWas) endThrow();
        padWas = pressed;
        break;
      }
    }
    if (nudged) aimOverride = null;
    if (charging) return;
    if (aimOverride) {
      aimX = aimOverride.x;
      aimY = aimOverride.y;
    } else if (!steerTouch && preferMotion()) {
      aimX = clamp((gamma - neutralGamma) / 28, -1, 1) * 0.9;
      aimY = clamp(REST_Y + ((beta - neutralBeta) / 26) * 0.85, 0.42, 2.45);
    }
    if (phase !== "back") {
      drawGlove.x = aimX;
      drawGlove.y = aimY;
      drawGlove.z = POCKET_Z;
    }
  }

  function step(dt: number) {
    if (phase === "hold") {
      holdT -= dt;
      if (holdT <= 0) releaseReturn();
      return;
    }
    if (phase === "down") {
      downT -= dt;
      if (!stuck) integrateBall(dt);
      if (downT <= 0) resetIdle();
      return;
    }
    if (phase === "out") {
      integrateBall(dt);
      const gap = dist(ball, PARTNER);
      const closing = closingSpeed(vel, ball, PARTNER);
      if (gap < 1.2 && closing > 0) {
        partnerCatch();
        return;
      }
      if (ball.z <= PARTNER.z + 0.15) {
        const miss = Math.hypot(ball.x - PARTNER.x, ball.y - PARTNER.y);
        if (miss < 2.15) partnerCatch();
        else playerShort();
        return;
      }
      if (ball.y <= 0.06 && ball.z > PARTNER.z + 2.2 && Math.hypot(vel.x, vel.y, vel.z) < 3.2) {
        playerShort();
      }
      return;
    }
    if (phase === "back") {
      backAge += dt;
      integrateBall(dt);
      const aim = { x: aimX, y: aimY, z: POCKET_Z };
      const result = evaluateCatch(prev, ball, aim, vel);
      drawGlove.x = result.glove.x;
      drawGlove.y = result.glove.y;
      drawGlove.z = result.glove.z;
      if (backAge > 0.12 && result.caught) {
        playerCatch(result.gem, Math.hypot(vel.x, vel.y, vel.z));
        return;
      }
      if (ball.z > 0.48 && vel.z > 0) playerMiss();
      else if (ball.y <= 0.05 && backAge > 0.35 && Math.hypot(vel.x, vel.y, vel.z) < 2.4) playerMiss();
    }
  }

  function integrateBall(dt: number) {
    prev.x = ball.x;
    prev.y = ball.y;
    prev.z = ball.z;
    integrate(ball, vel, dt);
    if (ball.y < 0.04 && vel.y < 0) {
      ball.y = 0.04;
      vel.y *= -0.42;
      vel.x *= 0.74;
      vel.z *= 0.74;
    }
  }

  function partnerCatch() {
    if (resolved) return;
    resolved = true;
    phase = "hold";
    holdT = 0.32;
    stuck = true;
    audio.whistleStop();
    audio.snap(0.42);
    emit(0, true);
  }

  function frame(now: number) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    applyAim(dt);
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 6) {
      step(STEP);
      acc -= STEP;
    }

    if (phase === "idle" || phase === "charge") {
      ball.x = phase === "charge" ? originX : aimX;
      ball.y = (phase === "charge" ? originY : aimY) + 0.03;
      ball.z = POCKET_Z + 0.02;
      drawGlove.x = phase === "charge" ? originX : aimX;
      drawGlove.y = phase === "charge" ? originY : aimY;
      drawGlove.z = POCKET_Z;
    } else if (stuck && (phase === "hold" || phase === "down")) {
      if (phase === "hold") {
        fielderMitt.getWorldPosition(tmp);
        ball.x = tmp.x;
        ball.y = tmp.y;
        ball.z = tmp.z;
      } else {
        ball.x = drawGlove.x;
        ball.y = drawGlove.y;
        ball.z = drawGlove.z;
      }
    }

    const flying = phase === "out" || phase === "back" || (phase === "down" && !stuck);
    for (let i = trail.length - 1; i >= 1; i--) {
      trail[i].position.copy(trail[i - 1].position);
      trail[i].visible = flying && trail[i - 1].visible;
    }
    trail[0].position.set(ball.x, ball.y, ball.z);
    trail[0].visible = flying;

    ballMesh.position.set(ball.x, ball.y, ball.z);
    if (flying) {
      ballMesh.rotation.x += vel.z * dt * 1.4;
      ballMesh.rotation.y += 8 * dt;
    }
    shadow.position.x = ball.x;
    shadow.position.z = ball.z;
    const lift = clamp(ball.y, 0, 12);
    const ss = clamp(1.05 - lift / 10, 0.28, 1.05);
    shadow.scale.setScalar(ss);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 0.28 * ss;

    const wantLook =
      phase === "idle" || phase === "charge" ? 1.32 : clamp(ball.y * 0.38 + 0.85, 1.05, 4.4);
    lookY += (wantLook - lookY) * (1 - Math.exp(-3.2 * dt));
    camera.position.set(0, 1.62, 0.85);
    if (!reduce && trauma > 0) {
      trauma = Math.max(0, trauma - dt * 1.5);
      const shake = trauma * trauma;
      camera.position.x += (Math.random() - 0.5) * 0.045 * shake;
      camera.position.y += (Math.random() - 0.5) * 0.03 * shake;
    }
    camera.lookAt(ball.x * 0.15, lookY, -14);
    fovKick = Math.max(0, fovKick - dt * 8);
    const portrait = canvas.clientHeight > canvas.clientWidth;
    const nextFov = (portrait ? 70 : 52) + fovKick;
    if (Math.abs(camera.fov - nextFov) > 0.05) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    tmp.set(drawGlove.x, drawGlove.y, drawGlove.z);
    camera.worldToLocal(tmp);
    playerMitt.position.copy(tmp);
    const cock = charging ? clamp(peakLive / 3, 0, 1) : 0;
    playerMitt.rotation.set(-0.42 - cock * 0.4, Math.PI, 0.08);
    glovePunch = Math.max(0, glovePunch - dt * 3.4);
    playerMitt.scale.setScalar(1.2 + glovePunch * 0.14);

    fielder.position.y = Math.sin(time * 1.7) * 0.012;
    fielder.updateMatrixWorld();
    if (phase === "out" && dist(ball, PARTNER) < 7) {
      fielder.worldToLocal(tmp.set(ball.x, ball.y, ball.z));
      fielderMitt.position.lerp(tmp, 1 - Math.exp(-8 * dt));
    } else if (phase !== "hold") {
      fielderMitt.position.lerp(mittHome, 1 - Math.exp(-4 * dt));
    }

    for (const p of puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= 2.2 * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      const mat = p.sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, p.life / p.max) * 0.75;
      if (p.life <= 0) p.sprite.visible = false;
    }
    if (gemLight.intensity > 0) gemLight.intensity = Math.max(0, gemLight.intensity - dt * 10);
    if (ringLife > 0) {
      ringLife -= dt;
      const u = 1 - ringLife / 0.38;
      ring.scale.setScalar(1 + u * 2.4);
      ring.lookAt(camera.position);
      (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ringLife / 0.38);
      if (ringLife <= 0) ring.visible = false;
    }
    for (const mote of motes) {
      const seed = mote.userData.seed as number;
      mote.position.y += Math.sin(time * 0.7 + seed) * 0.0015;
    }

    if (phase === "out" || phase === "back") {
      const cam = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
      audio.whistleUpdate(dist(ball, cam), closingSpeed(vel, ball, cam));
    }

    placeMark();
    emit(dt);
    renderer.render(scene, camera);
  }

  function placeMark() {
    if (!markEl || !markEl.isConnected) {
      markEl = canvas.parentElement?.querySelector("[data-catch-mark]") as HTMLElement | null;
    }
    if (phase !== "back") {
      spotLive = false;
      if (markEl) markEl.style.opacity = "0";
      return;
    }
    const pred = fly(ball, vel, POCKET_Z);
    if (!pred || pred.grounded || pred.point.y < 0.28 || !markEl) {
      spotLive = false;
      if (markEl) markEl.style.opacity = "0";
      return;
    }
    spotX = pred.point.x;
    spotY = pred.point.y;
    spotLive = true;
    markV.set(spotX, spotY, POCKET_Z);
    markV.project(camera);
    const x = markV.x * 0.5 + 0.5;
    const y = -markV.y * 0.5 + 0.5;
    const gap = Math.hypot(aimX - spotX, aimY - spotY);
    markEl.style.opacity = "1";
    markEl.style.left = `${x * 100}%`;
    markEl.style.top = `${y * 100}%`;
    markEl.dataset.ready = gap < 0.42 ? "1" : "0";
    markEl.dataset.gem = gap < 0.12 ? "1" : "0";
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const portrait = h > w;
    camera.fov = (portrait ? 70 : 52) + fovKick;
    camera.updateProjectionMatrix();
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    if (e.repeat) {
      keys.add(e.code);
      return;
    }
    keys.add(e.code);
    if (e.code === "Space") beginThrow();
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
    if (e.code === "Space") endThrow();
  }
  function onBlur() {
    keys.clear();
    if (charging) endThrow();
  }
  function onPointerDown(e: PointerEvent) {
    pointers.add(e.pointerId);
    if (!charging && e.pointerType === "touch") {
      steerTouch = true;
      setAimFromClient(e.clientX, e.clientY);
    }
  }
  function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (charging && chargePointer) endThrow();
  }
  function onPointerMove(e: PointerEvent) {
    const now = performance.now();
    const dx = haveP ? e.clientX - lastPX : e.movementX;
    const dy = haveP ? e.clientY - lastPY : e.movementY;
    const pdt = haveP ? Math.max(0.008, (now - lastPT) / 1000) : 1 / 60;
    lastPX = e.clientX;
    lastPY = e.clientY;
    lastPT = now;
    haveP = true;
    if (charging) {
      chargeDy += dy;
      pushSample(Math.hypot(dx, dy) / pdt / 480, false);
      return;
    }
    if (e.pointerType === "touch" && !pointers.has(e.pointerId)) return;
    if (e.pointerType === "touch") steerTouch = true;
    setAimFromClient(e.clientX, e.clientY);
  }
  function onMotion(e: DeviceMotionEvent) {
    if (!charging) return;
    const lin = e.acceleration;
    let x = 0;
    let y = 0;
    let z = 0;
    let used = false;
    if (lin && lin.x != null && lin.y != null && lin.z != null) {
      const mag = Math.abs(lin.x) + Math.abs(lin.y) + Math.abs(lin.z);
      if (mag > 0.08) {
        x = lin.x;
        y = lin.y;
        z = lin.z;
        used = true;
      }
    }
    if (!used && e.accelerationIncludingGravity) {
      const ig = e.accelerationIncludingGravity;
      if (ig.x == null || ig.y == null || ig.z == null) return;
      const rec = onMotion as unknown as { lp?: V3 };
      if (!rec.lp) rec.lp = { x: ig.x, y: ig.y, z: ig.z };
      rec.lp.x = rec.lp.x * 0.86 + ig.x * 0.14;
      rec.lp.y = rec.lp.y * 0.86 + ig.y * 0.14;
      rec.lp.z = rec.lp.z * 0.86 + ig.z * 0.14;
      x = ig.x - rec.lp.x;
      y = ig.y - rec.lp.y;
      z = ig.z - rec.lp.z;
      used = true;
    }
    if (!used) return;
    pushSample(Math.hypot(x, y, z) / 9.81, true);
  }
  function onOri(e: DeviceOrientationEvent) {
    if (e.beta == null || e.gamma == null) return;
    if (Math.abs(e.beta) < 0.35 && Math.abs(e.gamma) < 0.35) return;
    beta = e.beta;
    gamma = e.gamma;
    lastOri = performance.now();
    if (!haveOri) {
      neutralBeta = e.beta;
      neutralGamma = e.gamma;
      haveOri = true;
    }
  }
  function onVis() {
    if (document.visibilityState === "visible") audio.prime();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("devicemotion", onMotion);
  window.addEventListener("deviceorientation", onOri);
  document.addEventListener("visibilitychange", onVis);

  renderer.setAnimationLoop(frame);
  emit(0, true);

  const api: CatchGame = {
    prime() {
      audio.prime();
    },
    allow() {
      allowed = true;
      if (phase === "boot") phase = "idle";
      emit(0, true);
    },
    beginThrow,
    endThrow,
    setMuted(muted: boolean) {
      audio.setMuted(muted);
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOri);
      document.removeEventListener("visibilitychange", onVis);
      audio.dispose();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
      renderer.dispose();
      if (window.__catch) delete window.__catch;
    },
  };

  window.__catch = {
    phase: () => phase,
    streak: () => streak,
    quality: () => quality,
    mph: () => mph,
    aim: () => ({ x: aimX, y: aimY }),
    swing: () => beginThrow(true),
    release: () => endThrow(),
    throwWith(g: number, jerk = 0) {
      if (!allowed || phase !== "idle" || charging) return false;
      charging = true;
      phase = "charge";
      samples.length = 0;
      sawDevice = true;
      peakLive = g;
      chargeDy = jerk > 0.55 ? -90 : -8;
      originX = aimX;
      originY = aimY;
      betaAtPress = beta;
      const now = performance.now();
      const span = 280;
      const n = 10;
      for (let i = 0; i < n; i++) {
        const wobble = i % 2 === 0 ? jerk * 10 : -jerk * 3;
        samples.push({ t: now - span + (i * span) / (n - 1), g: Math.max(0.2, g + wobble) });
      }
      finishThrow();
      return true;
    },
    setAim(x: number, y: number) {
      aimOverride = { x, y };
      aimX = x;
      aimY = y;
    },
  };

  return api;
}

function makeMitt(
  geom: <T extends THREE.BufferGeometry>(g: T) => T,
  leather: THREE.Material,
  pocket: THREE.Material,
  lace: THREE.Material,
  scale: number,
) {
  const g = new THREE.Group();
  const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  add(new THREE.Mesh(geom(new THREE.BoxGeometry(0.22, 0.24, 0.07)), leather), 0.01, -0.02, 0);
  const thumb = add(new THREE.Mesh(geom(new THREE.BoxGeometry(0.07, 0.16, 0.055)), leather), -0.13, 0.02, 0.02);
  thumb.rotation.z = 0.55;
  for (let i = 0; i < 4; i++) {
    const finger = add(
      new THREE.Mesh(geom(new THREE.BoxGeometry(0.042, 0.13, 0.045)), leather),
      -0.055 + i * 0.046,
      0.15,
      0.01,
    );
    finger.rotation.x = -0.3;
    finger.rotation.z = (i - 1.5) * 0.06;
  }
  const web = add(new THREE.Mesh(geom(new THREE.BoxGeometry(0.1, 0.09, 0.012)), lace), -0.07, 0.09, 0.045);
  web.rotation.z = 0.5;
  const well = add(new THREE.Mesh(geom(new THREE.SphereGeometry(0.065, 12, 8)), pocket), 0.02, 0.01, 0.03);
  well.scale.set(1.25, 1, 0.4);
  add(new THREE.Mesh(geom(new THREE.BoxGeometry(0.14, 0.08, 0.07)), leather), 0.02, -0.16, -0.01);
  g.scale.setScalar(scale);
  return g;
}

function noiseTex(hex: string, variance: number, repeatNoise: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (!g) {
    const t = new THREE.CanvasTexture(c);
    return t;
  }
  g.fillStyle = hex;
  g.fillRect(0, 0, 128, 128);
  const img = g.getImageData(0, 0, 128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * variance;
    img.data[i] = clampByte(img.data[i] + n);
    img.data[i + 1] = clampByte(img.data[i + 1] + n);
    img.data[i + 2] = clampByte(img.data[i + 2] + n);
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.15;
  for (let i = 0; i < repeatNoise; i++) {
    g.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    g.fillRect(Math.random() * 128, Math.random() * 128, 3, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ballTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (!g) return tex;
  g.fillStyle = "#f4efe4";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(150,120,90,${Math.random() * 0.18})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = "#c4372f";
  g.lineWidth = 5;
  g.lineCap = "round";
  const seam = (ox: number) => {
    g.beginPath();
    g.moveTo(ox, 18);
    g.bezierCurveTo(ox + 46, 70, ox - 36, 150, ox + 8, 238);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const y = 32 + i * 24;
      g.beginPath();
      g.moveTo(ox - 12, y);
      g.lineTo(ox + 14, y + 7);
      g.stroke();
    }
  };
  seam(78);
  seam(176);
  return tex;
}

function softCircle() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (!g) return tex;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,0.95)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return tex;
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, n));
}

declare global {
  interface Window {
    __catch?: {
      phase: () => string;
      streak: () => number;
      quality: () => string;
      mph: () => number | null;
      aim: () => { x: number; y: number };
      swing: () => void;
      release: () => void;
      throwWith: (g: number, jerk?: number) => boolean;
      setAim: (x: number, y: number) => void;
    };
  }
}
