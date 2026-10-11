import { n as INITIAL_HUD } from "./routes-CNDW0z7E.mjs";
import { C as SphereGeometry, D as Vector2, E as TorusGeometry, O as Vector3, S as ShaderMaterial, T as SpriteMaterial, _ as PointLight, a as CircleGeometry, b as SRGBColorSpace, c as DirectionalLight, d as HemisphereLight, f as Mesh, g as PlaneGeometry, h as PerspectiveCamera, i as CapsuleGeometry, l as FogExp2, m as MeshStandardMaterial, n as BoxGeometry, o as Color, p as MeshBasicMaterial, r as CanvasTexture, s as CylinderGeometry, t as WebGLRenderer, u as Group, v as Raycaster, w as Sprite, x as Scene, y as RepeatWrapping } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mount-Csk0nArV.js
function createAudio() {
	let ctx = null;
	let master = null;
	let sfx = null;
	let noise = null;
	let osc = null;
	let whistleGain = null;
	let mute = false;
	function ensure() {
		if (ctx) return ctx;
		ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
		master = ctx.createGain();
		sfx = ctx.createGain();
		master.gain.value = mute ? 0 : .9;
		sfx.connect(master);
		master.connect(ctx.destination);
		const len = Math.floor(ctx.sampleRate * .45);
		noise = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = noise.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
		return ctx;
	}
	function prime() {
		const c = ensure();
		if (c.state === "suspended") c.resume();
	}
	function burst(seconds, fromHz, toHz, gain, type, q) {
		const c = ensure();
		if (!noise || !sfx) return;
		const t = c.currentTime;
		const src = c.createBufferSource();
		src.buffer = noise;
		const filter = c.createBiquadFilter();
		filter.type = type;
		filter.Q.value = q;
		filter.frequency.setValueAtTime(Math.max(40, fromHz), t);
		filter.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), t + seconds);
		const g = c.createGain();
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(1e-4, t + seconds);
		src.connect(filter);
		filter.connect(g);
		g.connect(sfx);
		src.start(t);
		src.stop(t + seconds + .02);
		src.onended = () => {
			src.disconnect();
			filter.disconnect();
			g.disconnect();
		};
	}
	function tone(freq, seconds, gain, wave) {
		const c = ensure();
		if (!sfx) return;
		const t = c.currentTime;
		const o = c.createOscillator();
		o.type = wave;
		o.frequency.setValueAtTime(freq, t);
		o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * .55), t + seconds);
		const g = c.createGain();
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(1e-4, t + seconds);
		o.connect(g);
		g.connect(sfx);
		o.start(t);
		o.stop(t + seconds + .02);
		o.onended = () => {
			o.disconnect();
			g.disconnect();
		};
	}
	return {
		prime,
		swoosh() {
			prime();
			burst(.16, 2400, 380, .22, "bandpass", .7);
		},
		whistleStart() {
			const c = ensure();
			if (!sfx) return;
			this.whistleStop();
			osc = c.createOscillator();
			osc.type = "triangle";
			osc.frequency.value = 720;
			const filter = c.createBiquadFilter();
			filter.type = "bandpass";
			filter.frequency.value = 1600;
			filter.Q.value = 5;
			whistleGain = c.createGain();
			whistleGain.gain.value = 0;
			osc.connect(filter);
			filter.connect(whistleGain);
			whistleGain.connect(sfx);
			osc.start();
			whistleGain.gain.setTargetAtTime(.045, c.currentTime, .04);
		},
		whistleUpdate(distance, closing) {
			if (!ctx || !osc || !whistleGain) return;
			const near = 1 - Math.max(0, Math.min(1, distance / 22));
			const doppler = 1 + Math.max(-.3, Math.min(.5, closing / 70));
			const freq = (640 + near * 480) * doppler;
			osc.frequency.setTargetAtTime(freq, ctx.currentTime, .05);
			whistleGain.gain.setTargetAtTime(.03 + near * .07, ctx.currentTime, .06);
		},
		whistleStop() {
			if (!ctx || !osc || !whistleGain) {
				osc = null;
				whistleGain = null;
				return;
			}
			const dying = osc;
			const g = whistleGain;
			g.gain.cancelScheduledValues(ctx.currentTime);
			g.gain.setTargetAtTime(0, ctx.currentTime, .03);
			window.setTimeout(() => {
				try {
					dying.stop();
				} catch {}
				dying.disconnect();
				g.disconnect();
			}, 140);
			osc = null;
			whistleGain = null;
		},
		snap(amount) {
			prime();
			const a = Math.max(.35, Math.min(1, amount));
			burst(.045, 3200, 900, .34 * a, "highpass", .6);
			tone(150, .09, .28 * a, "sine");
		},
		thud() {
			prime();
			burst(.12, 240, 80, .2, "lowpass", .7);
			tone(90, .14, .16, "sine");
		},
		setMuted(next) {
			mute = next;
			if (master && ctx) master.gain.setTargetAtTime(next ? 0 : .9, ctx.currentTime, .02);
		},
		muted: () => mute,
		dispose() {
			this.whistleStop();
			ctx?.close();
			ctx = null;
		}
	};
}
var GRAVITY = 9.81;
var LINEAR_DRAG = .04;
var GLOVE_R = .25;
var MPH_TO_MS = .44704;
var PARTNER_Z = -21.6;
var POCKET_Z = .05;
function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}
function clone(v) {
	return {
		x: v.x,
		y: v.y,
		z: v.z
	};
}
function dist(a, b) {
	return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function integrate(p, v, dt) {
	v.y -= GRAVITY * dt;
	const damp = Math.max(0, 1 - LINEAR_DRAG * dt);
	v.x *= damp;
	v.y *= damp;
	v.z *= damp;
	p.x += v.x * dt;
	p.y += v.y * dt;
	p.z += v.z * dt;
}
function fly(origin, velocity, planeZ, dt = 1 / 120) {
	const p = clone(origin);
	const v = clone(velocity);
	const going = Math.sign(planeZ - origin.z) || -1;
	let t = 0;
	for (let i = 0; i < 720; i++) {
		const prev = clone(p);
		integrate(p, v, dt);
		t += dt;
		if (going < 0 ? prev.z >= planeZ && p.z <= planeZ : prev.z <= planeZ && p.z >= planeZ) {
			const dz = p.z - prev.z;
			const u = dz === 0 ? 1 : (planeZ - prev.z) / dz;
			return {
				point: {
					x: prev.x + (p.x - prev.x) * u,
					y: prev.y + (p.y - prev.y) * u,
					z: planeZ
				},
				time: t,
				grounded: false
			};
		}
		if (p.y < .04) return {
			point: clone(p),
			time: t,
			grounded: true
		};
	}
	return null;
}
function solveLaunch(origin, target, speed, desiredAngle, maxMiss = .55) {
	const dx = target.x - origin.x;
	const dz = target.z - origin.z;
	const flat = Math.hypot(dx, dz) || 1;
	const fx = dx / flat;
	const fz = dz / flat;
	let best = null;
	let bestScore = Infinity;
	let farthestZ = Infinity;
	let farthest = null;
	for (let i = 0; i <= 42; i++) {
		const angle = .08 + i / 42 * 1.12;
		const cos = Math.cos(angle);
		const velocity = {
			x: fx * speed * cos,
			y: speed * Math.sin(angle),
			z: fz * speed * cos
		};
		const hit = fly(origin, velocity, target.z);
		if (!hit) continue;
		if (hit.grounded) {
			if (hit.point.z < farthestZ) {
				farthestZ = hit.point.z;
				farthest = {
					velocity,
					reached: false,
					angle,
					miss: 99,
					hang: hit.time
				};
			}
			continue;
		}
		const miss = Math.hypot(hit.point.x - target.x, hit.point.y - target.y);
		if (miss > maxMiss) continue;
		const score = Math.abs(angle - desiredAngle);
		if (score < bestScore) {
			bestScore = score;
			best = {
				velocity,
				reached: true,
				angle,
				miss,
				hang: hit.time
			};
		}
	}
	if (best) return best;
	if (farthest) return farthest;
	const angle = .45;
	const cos = Math.cos(angle);
	return {
		velocity: {
			x: fx * speed * cos,
			y: speed * Math.sin(angle),
			z: fz * speed * cos
		},
		reached: false,
		angle,
		miss: 99,
		hang: 0
	};
}
var MPH_CURVE = [
	[.6, 27],
	[1, 33],
	[1.5, 44],
	[2, 52],
	[2.5, 63],
	[3.15, 71]
];
function mphFromG(g) {
	if (g <= MPH_CURVE[0][0]) return MPH_CURVE[0][1];
	for (let i = 1; i < MPH_CURVE.length; i++) {
		const [g0, m0] = MPH_CURVE[i - 1];
		const [g1, m1] = MPH_CURVE[i];
		if (g <= g1) return m0 + (m1 - m0) * (g - g0) / (g1 - g0);
	}
	return MPH_CURVE[MPH_CURVE.length - 1][1];
}
function readSwing(samples) {
	if (samples.length < 2) return {
		ok: false,
		reason: "soft"
	};
	let peak = 0;
	for (const s of samples) peak = Math.max(peak, s.g);
	if (peak < .6) return {
		ok: false,
		reason: "soft"
	};
	const active = samples.filter((s) => s.g >= .55);
	if (active.length < 2) return {
		ok: false,
		reason: "soft"
	};
	const duration = (active[active.length - 1].t - active[0].t) / 1e3;
	if (duration < .15) return {
		ok: false,
		reason: "quick"
	};
	if (duration > .8) return {
		ok: false,
		reason: "slow"
	};
	let jerkAcc = 0;
	let n = 0;
	for (let i = 1; i < active.length; i++) {
		const dt = (active[i].t - active[i - 1].t) / 1e3;
		if (dt < .004 || dt > .2) continue;
		jerkAcc += Math.abs(active[i].g - active[i - 1].g) / dt;
		n++;
	}
	const jerk = clamp(((n ? jerkAcc / n : 0) - 5) / 34, 0, 1);
	return {
		ok: true,
		peak,
		jerk,
		duration
	};
}
function qualityFrom(jerk, reached) {
	if (!reached) return "Short";
	if (jerk < .28) return "True";
	if (jerk < .62) return "Loft";
	return "Pop";
}
function segmentSphereHit(p0, p1, center, radius) {
	const dx = p1.x - p0.x;
	const dy = p1.y - p0.y;
	const dz = p1.z - p0.z;
	const fx = p0.x - center.x;
	const fy = p0.y - center.y;
	const fz = p0.z - center.z;
	const a = dx * dx + dy * dy + dz * dz;
	const c = fx * fx + fy * fy + fz * fz - radius * radius;
	if (a < 1e-8) return c <= 0 ? 0 : null;
	const b = 2 * (fx * dx + fy * dy + fz * dz);
	const disc = b * b - 4 * a * c;
	if (disc < 0) return null;
	const s = Math.sqrt(disc);
	const t1 = (-b - s) / (2 * a);
	if (t1 >= 0 && t1 <= 1) return t1;
	const t2 = (-b + s) / (2 * a);
	if (t2 >= 0 && t2 <= 1) return t2;
	return null;
}
function segmentPointDist(p0, p1, c) {
	const dx = p1.x - p0.x;
	const dy = p1.y - p0.y;
	const dz = p1.z - p0.z;
	const len2 = dx * dx + dy * dy + dz * dz;
	let u = 0;
	if (len2 > 1e-8) {
		u = ((c.x - p0.x) * dx + (c.y - p0.y) * dy + (c.z - p0.z) * dz) / len2;
		u = clamp(u, 0, 1);
	}
	return Math.hypot(p0.x + dx * u - c.x, p0.y + dy * u - c.y, p0.z + dz * u - c.z);
}
function closingSpeed(vel, from, to) {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const dz = to.z - from.z;
	const m = Math.hypot(dx, dy, dz);
	if (m < 1e-5) return 0;
	return (vel.x * dx + vel.y * dy + vel.z * dz) / m;
}
function evaluateCatch(prev, next, aim, vel) {
	const glove = {
		x: aim.x,
		y: aim.y,
		z: aim.z
	};
	const dEnd = dist(next, aim);
	if (dEnd < .5 && dEnd > 1e-5) {
		const k = Math.min(1, Math.max(0, 1 - GLOVE_R * .88 / dEnd));
		glove.x = aim.x + (next.x - aim.x) * k;
		glove.y = aim.y + (next.y - aim.y) * k;
		glove.z = aim.z + (next.z - aim.z) * k;
	}
	const hit = segmentSphereHit(prev, next, glove, GLOVE_R);
	const inside = dist(next, glove) <= GLOVE_R;
	const closing = closingSpeed(vel, prev, aim);
	const caught = (hit != null || inside) && closing > 0;
	return {
		caught,
		gem: caught && segmentPointDist(prev, next, aim) <= .08,
		glove
	};
}
function selfTest() {
	const errors = [];
	const origin = {
		x: 0,
		y: 1.2,
		z: POCKET_Z
	};
	const target = {
		x: 0,
		y: 1.28,
		z: PARTNER_Z
	};
	const slow = solveLaunch(origin, target, 30 * MPH_TO_MS, .4);
	const normal = solveLaunch(origin, target, 44 * MPH_TO_MS, .22);
	const hard = solveLaunch(origin, target, 65 * MPH_TO_MS, .18);
	const pop = solveLaunch(origin, target, 48 * MPH_TO_MS, 1.05);
	const flat = solveLaunch(origin, target, 48 * MPH_TO_MS, .18);
	if (slow.reached) errors.push(`30mph should fall short, hang ${slow.hang.toFixed(2)}`);
	if (!normal.reached) errors.push(`44mph should reach, miss ${normal.miss.toFixed(2)}`);
	if (!hard.reached) errors.push(`65mph should reach, miss ${hard.miss.toFixed(2)}`);
	if (!pop.reached || !flat.reached) errors.push("pop/flat should both reach");
	else if (pop.angle + .001 < flat.angle) errors.push(`pop angle ${pop.angle.toFixed(2)} below flat ${flat.angle.toFixed(2)}`);
	const back = solveLaunch({
		x: 0,
		y: 1.28,
		z: PARTNER_Z
	}, {
		x: .25,
		y: 1.45,
		z: POCKET_Z
	}, 16.4, .6, .22);
	if (!back.reached || back.miss > .22) errors.push(`return miss ${back.miss.toFixed(2)} reached ${back.reached}`);
	const gem = evaluateCatch({
		x: 0,
		y: 1.16,
		z: -.3
	}, {
		x: 0,
		y: 1.16,
		z: .1
	}, {
		x: 0,
		y: 1.16,
		z: POCKET_Z
	}, {
		x: 0,
		y: 0,
		z: 16
	});
	if (!gem.caught || !gem.gem) errors.push("centerline should be a web gem");
	const save = evaluateCatch({
		x: 0,
		y: 1.16,
		z: -.2
	}, {
		x: 0,
		y: 1.16,
		z: .08
	}, {
		x: .4,
		y: 1.16,
		z: POCKET_Z
	}, {
		x: 0,
		y: 0,
		z: 14
	});
	if (!save.caught || save.gem) errors.push("0.4m offset should catch without gem");
	if (evaluateCatch({
		x: 0,
		y: 1.16,
		z: -.2
	}, {
		x: 0,
		y: 1.16,
		z: .08
	}, {
		x: .85,
		y: 1.16,
		z: .05
	}, {
		x: 0,
		y: 0,
		z: 14
	}).caught) errors.push("0.85m offset should miss");
	return errors;
}
var BEST_KEY = "catch-best-streak";
var PARTNER = {
	x: 0,
	y: 1.28,
	z: PARTNER_Z
};
var REST_Y = 1.16;
var STEP = 1 / 120;
function mountGame(canvas, onHud) {
	const problems = selfTest();
	if (problems.length) console.warn("catch physics", problems);
	const audio = createAudio();
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const fine = window.matchMedia("(pointer: fine)").matches;
	const coarse = window.matchMedia("(pointer: coarse)").matches;
	let renderer;
	try {
		renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			powerPreference: "high-performance",
			alpha: false
		});
	} catch (err) {
		onHud({
			...INITIAL_HUD,
			phase: "error",
			error: err instanceof Error ? err.message : "This screen couldn't start the field."
		});
		return {
			prime() {},
			allow() {},
			beginThrow() {},
			endThrow() {},
			setMuted() {},
			dispose() {}
		};
	}
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = 4;
	renderer.toneMappingExposure = 1.05;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = 1;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.55 : 2));
	renderer.setClearColor(15185034, 1);
	const scene = new Scene();
	scene.fog = new FogExp2(15250570, .013);
	const camera = new PerspectiveCamera(64, 1, .06, 180);
	camera.position.set(0, 1.62, .85);
	const raycaster = new Raycaster();
	const pointerNdc = new Vector2();
	const markV = new Vector3();
	let markEl = null;
	const geos = [];
	const mats = [];
	const texs = [];
	const geom = (g) => {
		geos.push(g);
		return g;
	};
	const mat = (m) => {
		mats.push(m);
		return m;
	};
	const leather = mat(new MeshStandardMaterial({
		color: "#8d4b2b",
		roughness: .62,
		metalness: .04
	}));
	const pocketMat = mat(new MeshStandardMaterial({
		color: "#5c301c",
		roughness: .78,
		metalness: 0
	}));
	const lace = mat(new MeshStandardMaterial({
		color: "#f0e2cf",
		roughness: .45,
		metalness: .02
	}));
	const skin = mat(new MeshStandardMaterial({
		color: "#c69068",
		roughness: .7
	}));
	const shirt = mat(new MeshStandardMaterial({
		color: "#243646",
		roughness: .8
	}));
	const pants = mat(new MeshStandardMaterial({
		color: "#2c261f",
		roughness: .86
	}));
	const capMat = mat(new MeshStandardMaterial({
		color: "#1a1612",
		roughness: .55
	}));
	const wood = mat(new MeshStandardMaterial({
		color: "#6d4c34",
		roughness: .88
	}));
	const cactusMat = mat(new MeshStandardMaterial({
		color: "#3e6846",
		roughness: .9
	}));
	const mesaMat = mat(new MeshStandardMaterial({
		color: "#6e5344",
		roughness: 1,
		flatShading: true
	}));
	const sky = new Mesh(geom(new SphereGeometry(120, 24, 16)), mat(new ShaderMaterial({
		side: 1,
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
        `
	})));
	scene.add(sky);
	const grassTex = noiseTex("#74804a", 28, 24);
	grassTex.wrapS = grassTex.wrapT = RepeatWrapping;
	grassTex.repeat.set(18, 18);
	texs.push(grassTex);
	const dirtTex = noiseTex("#c4a06a", 22, 12);
	dirtTex.wrapS = dirtTex.wrapT = RepeatWrapping;
	dirtTex.repeat.set(6, 10);
	texs.push(dirtTex);
	const grass = new Mesh(geom(new CircleGeometry(70, 48)), mat(new MeshStandardMaterial({
		map: grassTex,
		roughness: 1,
		metalness: 0
	})));
	grass.rotation.x = -Math.PI / 2;
	grass.receiveShadow = true;
	scene.add(grass);
	const lane = new Mesh(geom(new PlaneGeometry(3.4, 26)), mat(new MeshStandardMaterial({
		map: dirtTex,
		roughness: 1,
		metalness: 0
	})));
	lane.rotation.x = -Math.PI / 2;
	lane.position.set(0, .012, -11);
	lane.receiveShadow = true;
	scene.add(lane);
	for (const [x, z, r] of [[
		0,
		.2,
		2.4
	], [
		0,
		-21.2,
		2.1
	]]) {
		const disc = new Mesh(geom(new CircleGeometry(r, 24)), mat(new MeshStandardMaterial({
			map: dirtTex,
			roughness: 1
		})));
		disc.rotation.x = -Math.PI / 2;
		disc.position.set(x, .02, z);
		disc.receiveShadow = true;
		scene.add(disc);
	}
	const chalk = mat(new MeshBasicMaterial({
		color: "#f4eadc",
		transparent: true,
		opacity: .35
	}));
	for (const side of [-1, 1]) {
		const line = new Mesh(geom(new BoxGeometry(.04, .01, 16)), chalk);
		line.position.set(side * .9, .03, -6);
		scene.add(line);
	}
	for (let i = 0; i < 9; i++) {
		const post = new Mesh(geom(new BoxGeometry(.08, 1.25, .08)), wood);
		post.position.set(-4 + i, .62, -24.3);
		post.castShadow = true;
		scene.add(post);
	}
	for (const y of [
		.4,
		.78,
		1.1
	]) {
		const rail = new Mesh(geom(new BoxGeometry(8.2, .055, .04)), wood);
		rail.position.set(0, y, -24.3);
		rail.castShadow = true;
		scene.add(rail);
	}
	const saguaro = (x, z, s) => {
		const g = new Group();
		const trunk = new Mesh(geom(new CylinderGeometry(.16 * s, .2 * s, 2.8 * s, 7)), cactusMat);
		trunk.position.y = 1.4 * s;
		trunk.castShadow = true;
		g.add(trunk);
		const arm = new Mesh(geom(new CylinderGeometry(.09 * s, .11 * s, .9 * s, 6)), cactusMat);
		arm.position.set(.28 * s, 1.7 * s, 0);
		arm.rotation.z = Math.PI / 2.5;
		arm.castShadow = true;
		g.add(arm);
		g.position.set(x, 0, z);
		scene.add(g);
	};
	saguaro(-7.5, -14, 1);
	saguaro(9.2, -28, 1.35);
	for (const [x, z, w, h, d] of [
		[
			-28,
			-78,
			34,
			11,
			16
		],
		[
			8,
			-90,
			42,
			16,
			18
		],
		[
			36,
			-70,
			28,
			9,
			14
		]
	]) {
		const mesa = new Mesh(geom(new BoxGeometry(w, h, d)), mesaMat);
		mesa.position.set(x, h * .35, z);
		scene.add(mesa);
	}
	const hemi = new HemisphereLight(16765608, 3811868, .72);
	scene.add(hemi);
	const sun = new DirectionalLight(16757355, 2.6);
	sun.position.set(16, 18, 10);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.near = 2;
	sun.shadow.camera.far = 60;
	sun.shadow.camera.left = -22;
	sun.shadow.camera.right = 22;
	sun.shadow.camera.top = 22;
	sun.shadow.camera.bottom = -22;
	sun.shadow.bias = -4e-4;
	scene.add(sun);
	sun.target.position.set(0, .5, -12);
	scene.add(sun.target);
	const playerMitt = makeMitt(geom, leather, pocketMat, lace, 1);
	camera.add(playerMitt);
	scene.add(camera);
	const fielder = new Group();
	fielder.position.set(0, 0, -22);
	const limb = (geo, material, x, y, z) => {
		const mesh = new Mesh(geo, material);
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		fielder.add(mesh);
		return mesh;
	};
	limb(geom(new CapsuleGeometry(.07, .5, 3, 6)), pants, -.1, .48, 0);
	limb(geom(new CapsuleGeometry(.07, .5, 3, 6)), pants, .1, .48, 0);
	limb(geom(new CapsuleGeometry(.16, .38, 3, 8)), shirt, 0, 1.12, 0);
	limb(geom(new SphereGeometry(.11, 14, 12)), skin, 0, 1.58, 0);
	limb(geom(new SphereGeometry(.118, 14, 10)), capMat, 0, 1.64, .01).scale.set(1, .72, 1);
	const brim = limb(geom(new BoxGeometry(.16, .02, .12)), capMat, 0, 1.6, .12);
	brim.castShadow = true;
	const fielderMitt = makeMitt(geom, leather, pocketMat, lace, .62);
	fielderMitt.position.set(.22, 1.2, .32);
	fielder.add(fielderMitt);
	scene.add(fielder);
	const mittHome = fielderMitt.position.clone();
	const ballTex = ballTexture();
	texs.push(ballTex);
	const ballMat = mat(new MeshStandardMaterial({
		map: ballTex,
		roughness: .42,
		metalness: .02,
		emissive: new Color("#ffd0a8"),
		emissiveIntensity: .15
	}));
	const ballMesh = new Mesh(geom(new SphereGeometry(.037, 24, 16)), ballMat);
	ballMesh.castShadow = true;
	scene.add(ballMesh);
	const soft = softCircle();
	texs.push(soft);
	const shadow = new Mesh(geom(new CircleGeometry(.28, 18)), mat(new MeshBasicMaterial({
		color: 1708556,
		transparent: true,
		opacity: .3,
		depthWrite: false
	})));
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.y = .025;
	scene.add(shadow);
	const trail = [];
	for (let i = 0; i < 10; i++) {
		const sm = mat(new SpriteMaterial({
			map: soft,
			color: 16183782,
			transparent: true,
			depthWrite: false,
			opacity: .22 * (1 - i / 12)
		}));
		const s = new Sprite(sm);
		s.scale.setScalar(.18 * (1 - i / 14));
		s.visible = false;
		scene.add(s);
		trail.push(s);
	}
	const puffs = [];
	for (let i = 0; i < 18; i++) {
		const sm = mat(new SpriteMaterial({
			map: soft,
			color: 14995636,
			transparent: true,
			depthWrite: false,
			opacity: 0
		}));
		const s = new Sprite(sm);
		s.visible = false;
		scene.add(s);
		puffs.push({
			sprite: s,
			vx: 0,
			vy: 0,
			vz: 0,
			life: 0,
			max: 1
		});
	}
	const gemLight = new PointLight(15778122, 0, 3.2, 2);
	scene.add(gemLight);
	const ring = new Mesh(geom(new TorusGeometry(.1, .012, 8, 28)), mat(new MeshBasicMaterial({
		color: 15778122,
		transparent: true,
		opacity: 0,
		depthWrite: false
	})));
	ring.visible = false;
	scene.add(ring);
	const motes = [];
	const moteMat = mat(new SpriteMaterial({
		map: soft,
		color: 15782576,
		transparent: true,
		depthWrite: false,
		opacity: .22
	}));
	for (let i = 0; i < 10; i++) {
		const s = new Sprite(moteMat);
		s.position.set((Math.random() - .5) * 12, .5 + Math.random() * 2.2, -1 - Math.random() * 20);
		s.scale.setScalar(.06 + Math.random() * .1);
		s.userData.seed = Math.random() * 10;
		scene.add(s);
		motes.push(s);
	}
	let allowed = false;
	let phase = "idle";
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
	let bannerTone = "good";
	let flashId = 0;
	let mph = null;
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
	let aimOverride = null;
	let steerTouch = false;
	let spotX = 0;
	let spotY = REST_Y;
	let spotLive = false;
	let originX = 0;
	let originY = REST_Y;
	const ball = {
		x: 0,
		y: REST_Y,
		z: POCKET_Z
	};
	const vel = {
		x: 0,
		y: 0,
		z: 0
	};
	const prev = {
		x: 0,
		y: REST_Y,
		z: POCKET_Z
	};
	const drawGlove = {
		x: 0,
		y: REST_Y,
		z: POCKET_Z
	};
	const samples = [];
	let haveOri = false;
	let beta = 60;
	let gamma = 0;
	let neutralBeta = 60;
	let neutralGamma = 0;
	let betaAtPress = 60;
	let lastOri = 0;
	const keys = /* @__PURE__ */ new Set();
	const pointers = /* @__PURE__ */ new Set();
	let chargePointer = false;
	let lastPX = 0;
	let lastPY = 0;
	let lastPT = 0;
	let haveP = false;
	let padWas = false;
	let last = performance.now();
	let acc = 0;
	let disposed = false;
	const tmp = new Vector3();
	function preferMotion() {
		return haveOri && !fine && performance.now() - lastOri < 1500;
	}
	function inputLabel() {
		if (preferMotion()) return "Tilt to the ball";
		return fine ? "Move to the ball" : "Drag to the ball";
	}
	function showBanner(text, tone) {
		banner = text;
		bannerTone = tone;
		bannerId += 1;
	}
	function liveTilt() {
		if (haveOri) return clamp((betaAtPress - beta) / 26, -1, 1);
		return clamp(-chargeDy / 240, -1, 1);
	}
	function coach() {
		if (phase === "charge") {
			const tilt = liveTilt();
			if ((performance.now() - chargeStart) / 1e3 > .72) return "Let go. Holding longer won't lob it.";
			if (tilt > .28) return haveOri ? "Tipped back. Let go to lob." : "Flicked up. Let go to lob.";
			if (tilt < -.28 && haveOri) return "Tip the top of the phone back to lob.";
			if (peakLive >= .6) return haveOri ? "Let go. Tip the top back to lob." : "Let go. Flick up to lob.";
			return haveOri ? "Swing up and let go." : "Flick up and let go.";
		}
		if (phase === "idle") return catches === 0 ? "Swing up and let go. Tip back to lob." : "";
		if (phase === "out") return "On its way.";
		if (phase === "hold") return "Gold ring shows where to catch.";
		if (phase !== "back" || !spotLive) return "";
		const gap = Math.hypot(aimX - spotX, aimY - spotY);
		if (gap < .12) return "Hold still. That's the web.";
		if (gap < .42) return "Hold still. That's a catch.";
		return "Drag the mitt into the gold ring.";
	}
	function emit(dt, force = false) {
		emitAcc += dt;
		if (!force && emitAcc < .12) return;
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
			error: ""
		});
	}
	function trimSamples() {
		const cutoff = performance.now() - 1600;
		let drop = 0;
		while (drop < samples.length && samples[drop].t < cutoff) drop++;
		if (drop) samples.splice(0, drop);
	}
	function pushSample(g, fromDevice) {
		if (fromDevice && !sawDevice) {
			samples.length = 0;
			sawDevice = true;
		}
		if (!fromDevice && sawDevice) return;
		peakLive = Math.max(peakLive, g);
		samples.push({
			t: performance.now(),
			g
		});
		trimSamples();
	}
	function burst(x, y, z) {
		let spawned = 0;
		for (const p of puffs) {
			if (p.life > 0) continue;
			const ang = Math.random() * Math.PI * 2;
			const spd = .6 + Math.random() * 1.6;
			p.vx = Math.cos(ang) * spd;
			p.vz = Math.sin(ang) * spd * .7;
			p.vy = .8 + Math.random() * 1.8;
			p.life = .28 + Math.random() * .22;
			p.max = p.life;
			p.sprite.visible = true;
			p.sprite.position.set(x, y, z);
			p.sprite.scale.setScalar(.08 + Math.random() * .12);
			spawned++;
			if (spawned >= 14) break;
		}
	}
	function buzz(speed) {
		const ms = Math.round(80 + clamp(speed / 28, 0, 1) * 40);
		navigator.vibrate?.(ms);
	}
	function rememberBest() {
		if (streak > best) {
			best = streak;
			try {
				localStorage.setItem(BEST_KEY, String(best));
			} catch {}
		}
	}
	function playerCatch(gem, speed) {
		if (resolved) return;
		resolved = true;
		stuck = true;
		phase = "down";
		catches += 1;
		streak += gem ? 2 : 1;
		rememberBest();
		audio.whistleStop();
		audio.snap(gem ? 1 : .72 + clamp(speed / 30, 0, .28));
		buzz(speed);
		burst(drawGlove.x, drawGlove.y, drawGlove.z);
		trauma = reduce ? 0 : gem ? .62 : .4;
		glovePunch = 1;
		gemLight.position.set(drawGlove.x, drawGlove.y, drawGlove.z);
		if (gem) {
			gemLight.intensity = 7;
			flashId += 1;
			ring.position.set(drawGlove.x, drawGlove.y, drawGlove.z);
			ring.visible = true;
			ring.scale.setScalar(1);
			ringLife = .38;
			showBanner("Web gem", "gem");
		} else {
			gemLight.intensity = 1.4;
			showBanner("Caught", "good");
		}
		downT = gem ? 1.05 : .9;
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
		const target = {
			x: (Math.random() * 2 - 1) * (.04 + throwJerk * .7),
			y: 1.12 + throwJerk * .45,
			z: POCKET_Z
		};
		let speed = clamp(outSpeed * .78, 14.5, 20);
		let launch = solveLaunch(clone(PARTNER), target, speed, .32 + throwJerk * .85, .2);
		if (!launch.reached) {
			speed += 3;
			launch = solveLaunch(clone(PARTNER), target, speed, .4, .35);
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
		const swing = readSwing(samples.filter((s) => s.t >= cutoff));
		samples.length = 0;
		sawDevice = false;
		if (!swing.ok) {
			showBanner(swing.reason === "soft" ? "Too soft" : swing.reason === "quick" ? "Too quick" : "Held too long", "bad");
			phase = "idle";
			emit(0, true);
			return;
		}
		const tilt = liveTilt();
		const loft = clamp(swing.jerk * .85 + Math.max(0, tilt) * .45 - Math.max(0, -tilt) * .08, 0, 1);
		let mphValue = mphFromG(swing.peak);
		let desired = .16 + loft * .95;
		let missLimit = .7;
		const lob = tilt > .28;
		if (lob) {
			mphValue = Math.min(mphValue, 36 + (1 - tilt) * 4);
			desired = 1.05;
			missLimit = 1.45;
		}
		const speed = clamp(mphValue * MPH_TO_MS, 8, 34);
		const origin = {
			x: originX,
			y: originY,
			z: POCKET_Z
		};
		const launch = solveLaunch(origin, {
			x: (Math.random() * 2 - 1) * .35 * swing.jerk,
			y: PARTNER.y,
			z: PARTNER.z
		}, speed, desired, missLimit);
		ball.x = origin.x;
		ball.y = origin.y;
		ball.z = origin.z;
		vel.x = launch.velocity.x;
		vel.y = launch.velocity.y;
		vel.z = launch.velocity.z;
		outSpeed = speed;
		throwJerk = swing.jerk;
		mph = Math.round(mphValue);
		quality = lob && launch.reached && launch.angle > .75 ? "Lob" : qualityFrom(swing.jerk, launch.reached);
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
	function setAimFromClient(cx, cy) {
		const rect = canvas.getBoundingClientRect();
		pointerNdc.x = (cx - rect.left) / Math.max(1, rect.width) * 2 - 1;
		pointerNdc.y = -((cy - rect.top) / Math.max(1, rect.height) * 2 - 1);
		camera.updateMatrixWorld();
		raycaster.setFromCamera(pointerNdc, camera);
		const dir = raycaster.ray.direction;
		if (Math.abs(dir.z) < 1e-4) return;
		const t = (POCKET_Z - raycaster.ray.origin.z) / dir.z;
		if (t <= 0) return;
		aimX = clamp(raycaster.ray.origin.x + dir.x * t, -.95, .95);
		aimY = clamp(raycaster.ray.origin.y + dir.y * t, .42, 2.45);
		aimOverride = null;
	}
	function applyAim(dt) {
		let nudged = false;
		const right = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
		const up = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
		if (right || up) {
			aimX = clamp(aimX + right * 1.35 * dt, -.95, .95);
			aimY = clamp(aimY + up * 1.15 * dt, .42, 2.45);
			nudged = true;
		}
		const pads = navigator.getGamepads?.();
		if (pads) for (const pad of pads) {
			if (!pad) continue;
			let x = pad.axes[0] ?? 0;
			let y = pad.axes[1] ?? 0;
			const m = Math.hypot(x, y);
			if (m < .18) {
				x = 0;
				y = 0;
			} else {
				const s = (m - .18) / (.82 * m);
				x *= s;
				y *= s;
			}
			if (x || y) {
				aimX = clamp(aimX + x * 1.45 * dt, -.95, .95);
				aimY = clamp(aimY - y * 1.2 * dt, .42, 2.45);
				nudged = true;
			}
			const pressed = !!pad.buttons[0]?.pressed;
			if (pressed && !padWas) beginThrow();
			if (!pressed && padWas) endThrow();
			padWas = pressed;
			break;
		}
		if (nudged) aimOverride = null;
		if (charging) return;
		if (aimOverride) {
			aimX = aimOverride.x;
			aimY = aimOverride.y;
		} else if (!steerTouch && preferMotion()) {
			aimX = clamp((gamma - neutralGamma) / 28, -1, 1) * .9;
			aimY = clamp(REST_Y + (beta - neutralBeta) / 26 * .85, .42, 2.45);
		}
		if (phase !== "back") {
			drawGlove.x = aimX;
			drawGlove.y = aimY;
			drawGlove.z = POCKET_Z;
		}
	}
	function step(dt) {
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
			if (ball.z <= PARTNER.z + .15) {
				if (Math.hypot(ball.x - PARTNER.x, ball.y - PARTNER.y) < 2.15) partnerCatch();
				else playerShort();
				return;
			}
			if (ball.y <= .06 && ball.z > PARTNER.z + 2.2 && Math.hypot(vel.x, vel.y, vel.z) < 3.2) playerShort();
			return;
		}
		if (phase === "back") {
			backAge += dt;
			integrateBall(dt);
			const result = evaluateCatch(prev, ball, {
				x: aimX,
				y: aimY,
				z: POCKET_Z
			}, vel);
			drawGlove.x = result.glove.x;
			drawGlove.y = result.glove.y;
			drawGlove.z = result.glove.z;
			if (backAge > .12 && result.caught) {
				playerCatch(result.gem, Math.hypot(vel.x, vel.y, vel.z));
				return;
			}
			if (ball.z > .48 && vel.z > 0) playerMiss();
			else if (ball.y <= .05 && backAge > .35 && Math.hypot(vel.x, vel.y, vel.z) < 2.4) playerMiss();
		}
	}
	function integrateBall(dt) {
		prev.x = ball.x;
		prev.y = ball.y;
		prev.z = ball.z;
		integrate(ball, vel, dt);
		if (ball.y < .04 && vel.y < 0) {
			ball.y = .04;
			vel.y *= -.42;
			vel.x *= .74;
			vel.z *= .74;
		}
	}
	function partnerCatch() {
		if (resolved) return;
		resolved = true;
		phase = "hold";
		holdT = .32;
		stuck = true;
		audio.whistleStop();
		audio.snap(.42);
		emit(0, true);
	}
	function frame(now) {
		if (disposed) return;
		const dt = Math.min(.05, (now - last) / 1e3);
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
			ball.y = (phase === "charge" ? originY : aimY) + .03;
			ball.z = POCKET_Z + .02;
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
		const flying = phase === "out" || phase === "back" || phase === "down" && !stuck;
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
		const ss = clamp(1.05 - clamp(ball.y, 0, 12) / 10, .28, 1.05);
		shadow.scale.setScalar(ss);
		shadow.material.opacity = .28 * ss;
		const wantLook = phase === "idle" || phase === "charge" ? 1.32 : clamp(ball.y * .38 + .85, 1.05, 4.4);
		lookY += (wantLook - lookY) * (1 - Math.exp(-3.2 * dt));
		camera.position.set(0, 1.62, .85);
		if (!reduce && trauma > 0) {
			trauma = Math.max(0, trauma - dt * 1.5);
			const shake = trauma * trauma;
			camera.position.x += (Math.random() - .5) * .045 * shake;
			camera.position.y += (Math.random() - .5) * .03 * shake;
		}
		camera.lookAt(ball.x * .15, lookY, -14);
		fovKick = Math.max(0, fovKick - dt * 8);
		const nextFov = (canvas.clientHeight > canvas.clientWidth ? 70 : 52) + fovKick;
		if (Math.abs(camera.fov - nextFov) > .05) {
			camera.fov = nextFov;
			camera.updateProjectionMatrix();
		}
		camera.updateMatrixWorld();
		tmp.set(drawGlove.x, drawGlove.y, drawGlove.z);
		camera.worldToLocal(tmp);
		playerMitt.position.copy(tmp);
		const cock = charging ? clamp(peakLive / 3, 0, 1) : 0;
		playerMitt.rotation.set(-.42 - cock * .4, Math.PI, .08);
		glovePunch = Math.max(0, glovePunch - dt * 3.4);
		playerMitt.scale.setScalar(1.2 + glovePunch * .14);
		fielder.position.y = Math.sin(time * 1.7) * .012;
		fielder.updateMatrixWorld();
		if (phase === "out" && dist(ball, PARTNER) < 7) {
			fielder.worldToLocal(tmp.set(ball.x, ball.y, ball.z));
			fielderMitt.position.lerp(tmp, 1 - Math.exp(-8 * dt));
		} else if (phase !== "hold") fielderMitt.position.lerp(mittHome, 1 - Math.exp(-4 * dt));
		for (const p of puffs) {
			if (p.life <= 0) continue;
			p.life -= dt;
			p.vy -= 2.2 * dt;
			p.sprite.position.x += p.vx * dt;
			p.sprite.position.y += p.vy * dt;
			p.sprite.position.z += p.vz * dt;
			const mat = p.sprite.material;
			mat.opacity = Math.max(0, p.life / p.max) * .75;
			if (p.life <= 0) p.sprite.visible = false;
		}
		if (gemLight.intensity > 0) gemLight.intensity = Math.max(0, gemLight.intensity - dt * 10);
		if (ringLife > 0) {
			ringLife -= dt;
			const u = 1 - ringLife / .38;
			ring.scale.setScalar(1 + u * 2.4);
			ring.lookAt(camera.position);
			ring.material.opacity = Math.max(0, ringLife / .38);
			if (ringLife <= 0) ring.visible = false;
		}
		for (const mote of motes) {
			const seed = mote.userData.seed;
			mote.position.y += Math.sin(time * .7 + seed) * .0015;
		}
		if (phase === "out" || phase === "back") {
			const cam = {
				x: camera.position.x,
				y: camera.position.y,
				z: camera.position.z
			};
			audio.whistleUpdate(dist(ball, cam), closingSpeed(vel, ball, cam));
		}
		placeMark();
		emit(dt);
		renderer.render(scene, camera);
	}
	function placeMark() {
		if (!markEl || !markEl.isConnected) markEl = canvas.parentElement?.querySelector("[data-catch-mark]");
		if (phase !== "back") {
			spotLive = false;
			if (markEl) markEl.style.opacity = "0";
			return;
		}
		const pred = fly(ball, vel, POCKET_Z);
		if (!pred || pred.grounded || pred.point.y < .28 || !markEl) {
			spotLive = false;
			if (markEl) markEl.style.opacity = "0";
			return;
		}
		spotX = pred.point.x;
		spotY = pred.point.y;
		spotLive = true;
		markV.set(spotX, spotY, POCKET_Z);
		markV.project(camera);
		const x = markV.x * .5 + .5;
		const y = -markV.y * .5 + .5;
		const gap = Math.hypot(aimX - spotX, aimY - spotY);
		markEl.style.opacity = "1";
		markEl.style.left = `${x * 100}%`;
		markEl.style.top = `${y * 100}%`;
		markEl.dataset.ready = gap < .42 ? "1" : "0";
		markEl.dataset.gem = gap < .12 ? "1" : "0";
	}
	function resize() {
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.fov = (h > w ? 70 : 52) + fovKick;
		camera.updateProjectionMatrix();
	}
	const ro = new ResizeObserver(() => resize());
	ro.observe(canvas);
	resize();
	function onKeyDown(e) {
		if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
		if (e.repeat) {
			keys.add(e.code);
			return;
		}
		keys.add(e.code);
		if (e.code === "Space") beginThrow();
	}
	function onKeyUp(e) {
		keys.delete(e.code);
		if (e.code === "Space") endThrow();
	}
	function onBlur() {
		keys.clear();
		if (charging) endThrow();
	}
	function onPointerDown(e) {
		pointers.add(e.pointerId);
		if (!charging && e.pointerType === "touch") {
			steerTouch = true;
			setAimFromClient(e.clientX, e.clientY);
		}
	}
	function onPointerUp(e) {
		pointers.delete(e.pointerId);
		if (charging && chargePointer) endThrow();
	}
	function onPointerMove(e) {
		const now = performance.now();
		const dx = haveP ? e.clientX - lastPX : e.movementX;
		const dy = haveP ? e.clientY - lastPY : e.movementY;
		const pdt = haveP ? Math.max(.008, (now - lastPT) / 1e3) : 1 / 60;
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
	function onMotion(e) {
		if (!charging) return;
		const lin = e.acceleration;
		let x = 0;
		let y = 0;
		let z = 0;
		let used = false;
		if (lin && lin.x != null && lin.y != null && lin.z != null) {
			if (Math.abs(lin.x) + Math.abs(lin.y) + Math.abs(lin.z) > .08) {
				x = lin.x;
				y = lin.y;
				z = lin.z;
				used = true;
			}
		}
		if (!used && e.accelerationIncludingGravity) {
			const ig = e.accelerationIncludingGravity;
			if (ig.x == null || ig.y == null || ig.z == null) return;
			const rec = onMotion;
			if (!rec.lp) rec.lp = {
				x: ig.x,
				y: ig.y,
				z: ig.z
			};
			rec.lp.x = rec.lp.x * .86 + ig.x * .14;
			rec.lp.y = rec.lp.y * .86 + ig.y * .14;
			rec.lp.z = rec.lp.z * .86 + ig.z * .14;
			x = ig.x - rec.lp.x;
			y = ig.y - rec.lp.y;
			z = ig.z - rec.lp.z;
			used = true;
		}
		if (!used) return;
		pushSample(Math.hypot(x, y, z) / 9.81, true);
	}
	function onOri(e) {
		if (e.beta == null || e.gamma == null) return;
		if (Math.abs(e.beta) < .35 && Math.abs(e.gamma) < .35) return;
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
	const api = {
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
		setMuted(muted) {
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
		}
	};
	window.__catch = {
		phase: () => phase,
		streak: () => streak,
		quality: () => quality,
		mph: () => mph,
		aim: () => ({
			x: aimX,
			y: aimY
		}),
		swing: () => beginThrow(true),
		release: () => endThrow(),
		throwWith(g, jerk = 0) {
			if (!allowed || phase !== "idle" || charging) return false;
			charging = true;
			phase = "charge";
			samples.length = 0;
			sawDevice = true;
			peakLive = g;
			chargeDy = jerk > .55 ? -90 : -8;
			originX = aimX;
			originY = aimY;
			betaAtPress = beta;
			const now = performance.now();
			const span = 280;
			const n = 10;
			for (let i = 0; i < n; i++) {
				const wobble = i % 2 === 0 ? jerk * 10 : -jerk * 3;
				samples.push({
					t: now - span + i * span / 9,
					g: Math.max(.2, g + wobble)
				});
			}
			finishThrow();
			return true;
		},
		setAim(x, y) {
			aimOverride = {
				x,
				y
			};
			aimX = x;
			aimY = y;
		}
	};
	return api;
}
function makeMitt(geom, leather, pocket, lace, scale) {
	const g = new Group();
	const add = (mesh, x, y, z) => {
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		g.add(mesh);
		return mesh;
	};
	add(new Mesh(geom(new BoxGeometry(.22, .24, .07)), leather), .01, -.02, 0);
	const thumb = add(new Mesh(geom(new BoxGeometry(.07, .16, .055)), leather), -.13, .02, .02);
	thumb.rotation.z = .55;
	for (let i = 0; i < 4; i++) {
		const finger = add(new Mesh(geom(new BoxGeometry(.042, .13, .045)), leather), -.055 + i * .046, .15, .01);
		finger.rotation.x = -.3;
		finger.rotation.z = (i - 1.5) * .06;
	}
	const web = add(new Mesh(geom(new BoxGeometry(.1, .09, .012)), lace), -.07, .09, .045);
	web.rotation.z = .5;
	add(new Mesh(geom(new SphereGeometry(.065, 12, 8)), pocket), .02, .01, .03).scale.set(1.25, 1, .4);
	add(new Mesh(geom(new BoxGeometry(.14, .08, .07)), leather), .02, -.16, -.01);
	g.scale.setScalar(scale);
	return g;
}
function noiseTex(hex, variance, repeatNoise) {
	const c = document.createElement("canvas");
	c.width = c.height = 128;
	const g = c.getContext("2d");
	if (!g) return new CanvasTexture(c);
	g.fillStyle = hex;
	g.fillRect(0, 0, 128, 128);
	const img = g.getImageData(0, 0, 128, 128);
	for (let i = 0; i < img.data.length; i += 4) {
		const n = (Math.random() - .5) * variance;
		img.data[i] = clampByte(img.data[i] + n);
		img.data[i + 1] = clampByte(img.data[i + 1] + n);
		img.data[i + 2] = clampByte(img.data[i + 2] + n);
	}
	g.putImageData(img, 0, 0);
	g.globalAlpha = .15;
	for (let i = 0; i < repeatNoise; i++) {
		g.fillStyle = Math.random() > .5 ? "#ffffff" : "#000000";
		g.fillRect(Math.random() * 128, Math.random() * 128, 3, 2);
	}
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	return tex;
}
function ballTexture() {
	const c = document.createElement("canvas");
	c.width = c.height = 256;
	const g = c.getContext("2d");
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	if (!g) return tex;
	g.fillStyle = "#f4efe4";
	g.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 500; i++) {
		g.fillStyle = `rgba(150,120,90,${Math.random() * .18})`;
		g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
	}
	g.strokeStyle = "#c4372f";
	g.lineWidth = 5;
	g.lineCap = "round";
	const seam = (ox) => {
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
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	if (!g) return tex;
	const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
	grd.addColorStop(0, "rgba(255,255,255,0.95)");
	grd.addColorStop(1, "rgba(255,255,255,0)");
	g.fillStyle = grd;
	g.fillRect(0, 0, 64, 64);
	return tex;
}
function clampByte(n) {
	return Math.max(0, Math.min(255, n));
}
//#endregion
export { mountGame };
