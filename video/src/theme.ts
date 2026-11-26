import { loadFont as loadDisplay } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

/** The app's three families: Fraunces for display, IBM Plex Sans for text, IBM Plex Mono for figures and kickers. */
export const display = loadDisplay("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const serif = loadDisplay("italic", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
export const sans = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;

/** Pactiq's palette, from frontend/src/app/globals.css. */
export const C = {
  paper: "#f2ede3",
  paper2: "#e8e0cf",
  card: "#fbf8f2",
  ink: "#17140f",
  ink2: "#4b453b",
  ink3: "#847c6e",
  rule: "#d6ccb9",
  seal: "#d13c1f",
  sealDark: "#a82d14",
  kept: "#1d6a46",
  gold: "#9c6f12",
  goldLight: "#e0b54a",
  quill: "#2a45a3",
};

export type Tone = "light" | "dark" | "brand";
export const TONE: Record<Tone, { bg: string; ink: string; muted: string; line: string; pill: string; accent: string }> = {
  light: { bg: C.paper, ink: C.ink, muted: "rgba(23,20,15,0.55)", line: "rgba(23,20,15,0.16)", pill: "rgba(251,248,242,0.88)", accent: C.seal },
  dark: { bg: C.ink, ink: "#f7f2e8", muted: "rgba(247,242,232,0.6)", line: "rgba(247,242,232,0.18)", pill: "rgba(23,20,15,0.66)", accent: "#ff8a6b" },
  brand: { bg: C.seal, ink: "#fff7ee", muted: "rgba(255,247,238,0.75)", line: "rgba(255,247,238,0.28)", pill: "rgba(120,24,8,0.5)", accent: C.goldLight },
};

export const SCENE_TONE: Record<string, Tone> = {
  open: "light", problem: "dark", turn: "brand", stake: "light", prove: "dark", settle: "light",
  whyqie: "dark", eco: "light", proof: "dark", why: "brand", trust: "light", close: "dark",
};
