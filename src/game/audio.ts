export type CatchAudio = {
  prime: () => void;
  swoosh: () => void;
  whistleStart: () => void;
  whistleUpdate: (distance: number, closing: number) => void;
  whistleStop: () => void;
  snap: (amount: number) => void;
  thud: () => void;
  setMuted: (muted: boolean) => void;
  muted: () => boolean;
  dispose: () => void;
};

export function createAudio(): CatchAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let osc: OscillatorNode | null = null;
  let whistleGain: GainNode | null = null;
  let mute = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    master.gain.value = mute ? 0 : 0.9;
    sfx.connect(master);
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.45);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function prime() {
    const c = ensure();
    if (c.state === "suspended") void c.resume();
  }

  function burst(
    seconds: number,
    fromHz: number,
    toHz: number,
    gain: number,
    type: BiquadFilterType,
    q: number,
  ) {
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
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfx);
    src.start(t);
    src.stop(t + seconds + 0.02);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  function tone(freq: number, seconds: number, gain: number, wave: OscillatorType) {
    const c = ensure();
    if (!sfx) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), t + seconds);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    o.connect(g);
    g.connect(sfx);
    o.start(t);
    o.stop(t + seconds + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  return {
    prime,
    swoosh() {
      prime();
      burst(0.16, 2400, 380, 0.22, "bandpass", 0.7);
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
      whistleGain.gain.setTargetAtTime(0.045, c.currentTime, 0.04);
    },
    whistleUpdate(distance: number, closing: number) {
      if (!ctx || !osc || !whistleGain) return;
      const near = 1 - Math.max(0, Math.min(1, distance / 22));
      const doppler = 1 + Math.max(-0.3, Math.min(0.5, closing / 70));
      const freq = (640 + near * 480) * doppler;
      osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
      whistleGain.gain.setTargetAtTime(0.03 + near * 0.07, ctx.currentTime, 0.06);
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
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      window.setTimeout(() => {
        try {
          dying.stop();
        } catch {
          /* already stopped */
        }
        dying.disconnect();
        g.disconnect();
      }, 140);
      osc = null;
      whistleGain = null;
    },
    snap(amount: number) {
      prime();
      const a = Math.max(0.35, Math.min(1, amount));
      burst(0.045, 3200, 900, 0.34 * a, "highpass", 0.6);
      tone(150, 0.09, 0.28 * a, "sine");
    },
    thud() {
      prime();
      burst(0.12, 240, 80, 0.2, "lowpass", 0.7);
      tone(90, 0.14, 0.16, "sine");
    },
    setMuted(next: boolean) {
      mute = next;
      if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.02);
    },
    muted: () => mute,
    dispose() {
      this.whistleStop();
      void ctx?.close();
      ctx = null;
    },
  };
}
