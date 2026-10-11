import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { INITIAL_HUD, type Hud, type Phase } from "@/game/hud";
import type { CatchGame } from "@/game/mount";

function requestMotion() {
  const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  const DME = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
  const jobs: Promise<string>[] = [];
  try {
    if (typeof DOE?.requestPermission === "function") jobs.push(DOE.requestPermission());
    if (typeof DME?.requestPermission === "function") jobs.push(DME.requestPermission());
  } catch {
    return;
  }
  if (jobs.length) void Promise.all(jobs).catch(() => undefined);
}

export function CatchApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<CatchGame | null>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let game: CatchGame | null = null;
    void import("@/game/mount").then((mod) => {
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
  const tone =
    hud.bannerTone === "gem" ? "text-gem" : hud.bannerTone === "bad" ? "text-dust" : "text-cream";

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink text-cream">
      <div className="dusk-wash absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label="Catch yard" />
      <div className="field-frame pointer-events-none absolute inset-0" />
      <div data-catch-mark className="catch-ring pointer-events-none absolute size-36 opacity-0" aria-hidden>
        <span className="catch-ring-web" />
      </div>

      {hud.flashId > 0 && (
        <div key={hud.flashId} className="catch-flash pointer-events-none absolute inset-0 bg-gem/50" />
      )}

      {started && (
        <header
          className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4 ${
            showThrow
              ? "pt-[max(8.5rem,calc(env(safe-area-inset-top)+8rem))]"
              : "pt-[max(1rem,env(safe-area-inset-top))]"
          }`}
        >
          <div>
            <p className="text-xs tracking-widest text-dust uppercase">Streak</p>
            <p key={hud.streak} className="streak-pop font-display text-5xl leading-none tabular-nums">
              {hud.streak}
            </p>
            <p className="mt-1 text-xs text-dust tabular-nums">Best {hud.best}</p>
            {hud.inputLabel && <p className="mt-2 text-xs text-dust">{hud.inputLabel}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-cream/20 bg-ink/70 text-cream"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                gameRef.current?.setMuted(next);
                gameRef.current?.prime();
              }}
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            {hud.phase === "charge" && hud.gee != null ? (
              <div className="text-right">
                <p className="font-display text-4xl leading-none tabular-nums">{hud.gee.toFixed(1)}g</p>
                <p className="text-xs tracking-widest text-dust uppercase">Speed</p>
              </div>
            ) : hud.mph != null ? (
              <div className="text-right">
                <p className="font-display text-4xl leading-none tabular-nums">{hud.mph}</p>
                <p className="text-xs tracking-widest text-dust uppercase">
                  mph{hud.quality ? ` · ${hud.quality}` : ""}
                </p>
              </div>
            ) : null}
          </div>
        </header>
      )}

      {showThrow && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-20 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <button
            type="button"
            data-testid="throw"
            aria-label={hud.phase === "charge" ? "Release" : "Hold to throw"}
            aria-pressed={hud.phase === "charge"}
            className="pointer-events-auto relative size-24 overflow-hidden rounded-full border-4 border-cream bg-leather font-display text-base text-ink"
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* already captured */
              }
              gameRef.current?.prime();
              gameRef.current?.beginThrow(true);
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span
              className={`absolute inset-x-0 bottom-0 ${hud.meter > 0.72 ? "bg-gem" : "bg-leather-deep/50"}`}
              style={{ height: `${Math.round(hud.meter * 100)}%` }}
            />
            <span className="relative">{hud.phase === "charge" ? "Release" : "Hold"}</span>
          </button>
          {hud.hint && (
            <p className="mt-2 rounded-full bg-ink/80 px-3 py-1.5 text-center font-display text-sm leading-tight text-balance text-cream">
              {hud.hint}
            </p>
          )}
        </div>
      )}

      {started && hud.banner && (
        <p
          key={hud.bannerId}
          className={`catch-banner pointer-events-none absolute inset-x-6 top-[38%] text-center font-display text-5xl italic ${tone}`}
        >
          {hud.banner}
        </p>
      )}

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!started ? (
          <div className="pointer-events-auto rounded-3xl border border-cream/15 bg-ink/90 px-5 py-5">
            <p className="text-xs tracking-widest text-dust uppercase">One ball</p>
            <h1 className="mt-1 font-display text-5xl leading-none text-balance">Catch</h1>
            <p className="mt-3 text-base leading-snug text-pretty text-dust">
              Grip the phone like a ball. Your pointer finger holds the button up by the camera. Let go at the
              release point, then drag the mitt into the gold ring.
            </p>
            {hud.phase === "error" && <p className="mt-3 text-sm text-gem">{hud.error}</p>}
            <button
              type="button"
              data-testid="play"
              disabled={!ready}
              onClick={play}
              className="mt-5 h-14 w-full rounded-full bg-leather font-display text-xl text-ink disabled:opacity-60"
            >
              {ready ? "Play" : "Lacing up"}
            </button>
          </div>
        ) : hud.hint || caption(hud.phase) ? (
          showThrow ? null : (
            <p
              className={`mx-auto max-w-sm rounded-full px-4 py-3 text-center font-display text-xl leading-tight text-balance ${
                hud.hint.startsWith("Hold still") ? "bg-gem/20 text-gem" : "bg-ink/80 text-cream"
              }`}
            >
              {hud.hint || caption(hud.phase)}
            </p>
          )
        ) : null}
      </footer>
    </main>
  );
}

function caption(phase: Phase) {
  if (phase === "out") return "On its way.";
  if (phase === "hold") return "Gold ring shows where to catch.";
  if (phase === "back") return "Drag the mitt into the gold ring.";
  return "";
}
