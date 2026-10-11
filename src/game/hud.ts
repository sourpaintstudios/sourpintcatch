export type Phase = "boot" | "idle" | "charge" | "out" | "hold" | "back" | "down" | "error";

export type Hud = {
  phase: Phase;
  streak: number;
  best: number;
  gee: number | null;
  mph: number | null;
  quality: string;
  meter: number;
  bannerId: number;
  banner: string;
  bannerTone: "good" | "gem" | "bad";
  inputLabel: string;
  hint: string;
  flashId: number;
  error: string;
};

export const INITIAL_HUD: Hud = {
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
  error: "",
};
