import { i as __toESM } from "../_runtime.mjs";
import { G as require_jsx_runtime, K as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Volume2, t as VolumeX } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CNDW0z7E.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var INITIAL_HUD = {
	phase: "boot",
	streak: 0,
	best: 0,
	gee: null,
	mph: null,
	quality: "",
	meter: 0,
	bannerId: 0,
	banner: "",
	bannerTone: "good",
	inputLabel: "",
	hint: "",
	flashId: 0,
	error: ""
};
function requestMotion() {
	const DOE = DeviceOrientationEvent;
	const DME = DeviceMotionEvent;
	const jobs = [];
	try {
		if (typeof DOE?.requestPermission === "function") jobs.push(DOE.requestPermission());
		if (typeof DME?.requestPermission === "function") jobs.push(DME.requestPermission());
	} catch {
		return;
	}
	if (jobs.length) Promise.all(jobs).catch(() => void 0);
}
function CatchApp() {
	const canvasRef = (0, import_react.useRef)(null);
	const gameRef = (0, import_react.useRef)(null);
	const [hud, setHud] = (0, import_react.useState)(INITIAL_HUD);
	const [started, setStarted] = (0, import_react.useState)(false);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [muted, setMuted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!canvasRef.current) return;
		let dead = false;
		let game = null;
		import("./mount-Csk0nArV.mjs").then((mod) => {
			if (dead || !canvasRef.current) return;
			game = mod.mountGame(canvasRef.current, setHud);
			gameRef.current = game;
			setReady(true);
		});
		return () => {
			dead = true;
			game?.dispose();
			gameRef.current = null;
		};
	}, []);
	function play() {
		const game = gameRef.current;
		if (!game) return;
		game.prime();
		requestMotion();
		game.allow();
		setStarted(true);
	}
	const showThrow = started && (hud.phase === "idle" || hud.phase === "charge");
	const tone = hud.bannerTone === "gem" ? "text-gem" : hud.bannerTone === "bad" ? "text-dust" : "text-cream";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "fixed inset-0 overflow-hidden bg-ink text-cream",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dusk-wash absolute inset-0" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 h-full w-full touch-none",
				"aria-label": "Catch yard"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "field-frame pointer-events-none absolute inset-0" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"data-catch-mark": true,
				className: "catch-ring pointer-events-none absolute size-36 opacity-0",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "catch-ring-web" })
			}),
			hud.flashId > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "catch-flash pointer-events-none absolute inset-0 bg-gem/50" }, hud.flashId),
			started && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-widest text-dust uppercase",
						children: "Streak"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "streak-pop font-display text-5xl leading-none tabular-nums",
						children: hud.streak
					}, hud.streak),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-dust tabular-nums",
						children: ["Best ", hud.best]
					}),
					hud.inputLabel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-dust",
						children: hud.inputLabel
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-end gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": muted ? "Unmute" : "Mute",
						className: "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-cream/20 bg-ink/70 text-cream",
						onClick: () => {
							const next = !muted;
							setMuted(next);
							gameRef.current?.setMuted(next);
							gameRef.current?.prime();
						},
						children: muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-5" })
					}), hud.phase === "charge" && hud.gee != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-display text-4xl leading-none tabular-nums",
							children: [hud.gee.toFixed(1), "g"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-widest text-dust uppercase",
							children: "Speed"
						})]
					}) : hud.mph != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-4xl leading-none tabular-nums",
							children: hud.mph
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs tracking-widest text-dust uppercase",
							children: ["mph", hud.quality ? ` · ${hud.quality}` : ""]
						})]
					}) : null]
				})]
			}),
			started && hud.banner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: `catch-banner pointer-events-none absolute inset-x-6 top-[32%] text-center font-display text-5xl italic ${tone}`,
				children: hud.banner
			}, hud.bannerId),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
				children: !started ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-auto rounded-3xl border border-cream/15 bg-ink/90 px-5 py-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-widest text-dust uppercase",
							children: "One ball"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-1 font-display text-5xl leading-none text-balance",
							children: "Catch"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-base leading-snug text-pretty text-dust",
							children: "Hold, swing the phone up, and let go. Tip the top back to lob — holding longer does not. Then drag the mitt into the gold ring."
						}),
						hud.phase === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-gem",
							children: hud.error
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"data-testid": "play",
							disabled: !ready,
							onClick: play,
							className: "mt-5 h-14 w-full rounded-full bg-leather font-display text-xl text-ink disabled:opacity-60",
							children: ready ? "Play" : "Lacing up"
						})
					]
				}) : showThrow ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-auto",
					children: [hud.hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mx-auto mb-3 max-w-sm rounded-full bg-ink/80 px-4 py-2 text-center font-display text-lg leading-tight text-balance text-cream",
						children: hud.hint
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"data-testid": "throw",
						"aria-pressed": hud.phase === "charge",
						className: "relative h-16 w-full overflow-hidden rounded-full bg-leather font-display text-2xl text-ink active:scale-95",
						onPointerDown: (e) => {
							e.preventDefault();
							try {
								e.currentTarget.setPointerCapture(e.pointerId);
							} catch {}
							gameRef.current?.prime();
							gameRef.current?.beginThrow(true);
						},
						onContextMenu: (e) => e.preventDefault(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `absolute inset-y-0 left-0 ${hud.meter > .72 ? "bg-gem" : "bg-leather-deep/50"}`,
							style: { width: `${Math.round(hud.meter * 100)}%` }
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "relative",
							children: hud.phase === "charge" ? "Let go" : "Hold to throw"
						})]
					})]
				}) : hud.hint || caption(hud.phase) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: `mx-auto max-w-sm rounded-full px-4 py-3 text-center font-display text-xl leading-tight text-balance ${hud.hint.startsWith("Hold still") ? "bg-gem/20 text-gem" : "bg-ink/80 text-cream"}`,
					children: hud.hint || caption(hud.phase)
				}) : null
			})
		]
	});
}
function caption(phase) {
	if (phase === "out") return "On its way.";
	if (phase === "hold") return "Gold ring shows where to catch.";
	if (phase === "back") return "Drag the mitt into the gold ring.";
	return "";
}
var routes_exports = /* @__PURE__ */ __exportAll({ component: () => Home });
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CatchApp, {});
}
//#endregion
export { INITIAL_HUD as n, routes_exports as t };
