/**
 * Bildanalyse und Punktelogik für den Boccia-Kamera-Zähler.
 *
 * Alles läuft lokal im Browser: Ein verkleinertes Kamerabild wird pixelweise
 * nach den Spielerfarben und der Zielkugel (Pallino) durchsucht. Zusammen-
 * hängende Farbflächen werden zu "Kugeln" gruppiert, und aus den Abständen
 * zur Zielkugel ergibt sich der Punktestand der laufenden Runde.
 */

export type BallColorKey =
  | "rot"
  | "blau"
  | "gelb"
  | "gruen"
  | "orange"
  | "violett";

export type JackColorKey = "weiss" | "gelb" | "orange";

export interface ColorDef {
  key: BallColorKey;
  label: string;
  /** CSS-Farbe für UI-Punkte und Overlay-Markierungen */
  css: string;
  /** Farbton-Bereich in Grad (0–360); bei from > to wird über 0° gewickelt (Rot) */
  hue: { from: number; to: number };
  minSaturation: number;
  minValue: number;
}

export const BALL_COLORS: ColorDef[] = [
  {
    key: "rot",
    label: "Rot",
    css: "#ef4444",
    hue: { from: 340, to: 15 },
    minSaturation: 0.42,
    minValue: 0.25,
  },
  {
    key: "orange",
    label: "Orange",
    css: "#f97316",
    hue: { from: 16, to: 42 },
    minSaturation: 0.45,
    minValue: 0.35,
  },
  {
    key: "gelb",
    label: "Gelb",
    css: "#eab308",
    hue: { from: 43, to: 70 },
    minSaturation: 0.4,
    minValue: 0.4,
  },
  {
    key: "gruen",
    label: "Grün",
    css: "#22c55e",
    hue: { from: 80, to: 165 },
    minSaturation: 0.35,
    minValue: 0.2,
  },
  {
    key: "blau",
    label: "Blau",
    css: "#3b82f6",
    hue: { from: 195, to: 255 },
    minSaturation: 0.35,
    minValue: 0.2,
  },
  {
    key: "violett",
    label: "Violett",
    css: "#a855f7",
    hue: { from: 265, to: 310 },
    minSaturation: 0.3,
    minValue: 0.2,
  },
];

export const JACK_COLORS: { key: JackColorKey; label: string; css: string }[] =
  [
    { key: "weiss", label: "Weiss", css: "#f8fafc" },
    { key: "gelb", label: "Gelb", css: "#eab308" },
    { key: "orange", label: "Orange", css: "#f97316" },
  ];

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hueInRange(h: number, from: number, to: number): boolean {
  return from <= to ? h >= from && h <= to : h >= from || h <= to;
}

export function matchesBallColor(hsv: Hsv, def: ColorDef): boolean {
  return (
    hsv.s >= def.minSaturation &&
    hsv.v >= def.minValue &&
    hueInRange(hsv.h, def.hue.from, def.hue.to)
  );
}

export function matchesJackColor(hsv: Hsv, key: JackColorKey): boolean {
  if (key === "weiss") {
    // Weiss: hell und nahezu ungesättigt
    return hsv.v >= 0.75 && hsv.s <= 0.18;
  }
  const def = BALL_COLORS.find(c => c.key === key)!;
  return matchesBallColor(hsv, def);
}

export interface Blob {
  x: number;
  y: number;
  area: number;
  width: number;
  height: number;
}

/** Minimaler Ausschnitt von ImageData, damit die Logik ohne DOM testbar ist */
export interface PixelSource {
  data: Uint8ClampedArray | number[];
  width: number;
  height: number;
}

/**
 * Zusammenhängende Flächen (4er-Nachbarschaft) in einer Binärmaske finden.
 * Liefert Schwerpunkt, Fläche und Bounding-Box je Fläche.
 */
export function findBlobs(
  mask: Uint8Array,
  width: number,
  height: number,
  minArea: number
): Blob[] {
  const visited = new Uint8Array(mask.length);
  const blobs: Blob[] = [];
  const stack: number[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    visited[start] = 1;
    stack.push(start);
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % width;
      const y = (idx / width) | 0;
      area++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && mask[idx - 1] && !visited[idx - 1]) {
        visited[idx - 1] = 1;
        stack.push(idx - 1);
      }
      if (x < width - 1 && mask[idx + 1] && !visited[idx + 1]) {
        visited[idx + 1] = 1;
        stack.push(idx + 1);
      }
      if (y > 0 && mask[idx - width] && !visited[idx - width]) {
        visited[idx - width] = 1;
        stack.push(idx - width);
      }
      if (y < height - 1 && mask[idx + width] && !visited[idx + width]) {
        visited[idx + width] = 1;
        stack.push(idx + width);
      }
    }

    if (area >= minArea) {
      blobs.push({
        x: sumX / area,
        y: sumY / area,
        area,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
    }
  }

  return blobs;
}

/** Grobe Rundheitsprüfung: Kugeln füllen ihre Bounding-Box zu ~78 % und sind etwa quadratisch */
export function looksRound(blob: Blob): boolean {
  const bbox = blob.width * blob.height;
  if (bbox === 0) return false;
  const fill = blob.area / bbox;
  const aspect = blob.width / blob.height;
  return fill >= 0.45 && aspect >= 0.45 && aspect <= 2.2;
}

export interface DetectionResult {
  jack: Blob | null;
  /** Erkannte Kugeln je Spielerfarbe */
  balls: Partial<Record<BallColorKey, Blob[]>>;
}

export interface DetectOptions {
  ballColors: BallColorKey[];
  jackColor: JackColorKey;
  /** Maximal zu wertende Kugeln pro Farbe */
  maxBallsPerColor: number;
  /** Mindestfläche einer Kugel in Pixeln (bezogen auf das verkleinerte Bild) */
  minArea?: number;
}

/**
 * Kugeln und Zielkugel in einem (verkleinerten) Bild erkennen.
 * Die Zielkugel ist die kleinste plausible Fläche ihrer Farbe – so wird bei
 * gleicher Farbe von Spielerkugeln nicht versehentlich eine grosse Kugel
 * als Pallino gewertet.
 */
export function detectScene(
  image: PixelSource,
  opts: DetectOptions
): DetectionResult {
  const { width, height, data } = image;
  const pixelCount = width * height;
  const minArea = opts.minArea ?? Math.max(8, Math.round(pixelCount / 4000));
  const maxArea = pixelCount / 8; // riesige Flächen sind Hintergrund, keine Kugel

  const masks = new Map<string, Uint8Array>();
  for (const key of opts.ballColors) masks.set(key, new Uint8Array(pixelCount));
  const jackMask = new Uint8Array(pixelCount);
  const jackIsBallColor = opts.ballColors.includes(
    opts.jackColor as BallColorKey
  );

  const defs = opts.ballColors.map(
    key => BALL_COLORS.find(c => c.key === key)!
  );

  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const hsv = rgbToHsv(data[o], data[o + 1], data[o + 2]);
    for (const def of defs) {
      if (matchesBallColor(hsv, def)) {
        masks.get(def.key)![i] = 1;
        break;
      }
    }
    if (!jackIsBallColor && matchesJackColor(hsv, opts.jackColor)) {
      jackMask[i] = 1;
    }
  }

  const balls: Partial<Record<BallColorKey, Blob[]>> = {};
  for (const key of opts.ballColors) {
    const found = findBlobs(masks.get(key)!, width, height, minArea)
      .filter(b => b.area <= maxArea && looksRound(b))
      .sort((a, b) => b.area - a.area)
      .slice(0, opts.maxBallsPerColor);
    balls[key] = found;
  }

  let jack: Blob | null = null;
  if (jackIsBallColor) {
    // Zielkugel teilt sich die Farbe mit einem Spieler: kleinste Kugel abzweigen
    const shared = balls[opts.jackColor as BallColorKey] ?? [];
    if (shared.length > 0) {
      const sorted = [...shared].sort((a, b) => a.area - b.area);
      jack = sorted[0];
      balls[opts.jackColor as BallColorKey] = shared.filter(b => b !== jack);
    }
  } else {
    const candidates = findBlobs(jackMask, width, height, minArea)
      .filter(b => b.area <= maxArea && looksRound(b))
      .sort((a, b) => b.area - a.area);
    jack = candidates[0] ?? null;
  }

  return { jack, balls };
}

export interface Point {
  x: number;
  y: number;
}

export interface PlayerScore {
  playerId: string;
  points: number;
  /** Abstände der eigenen Kugeln zur Zielkugel, aufsteigend sortiert */
  distances: number[];
}

/**
 * Boccia-Wertung: Es punktet nur, wer die näheste Kugel an der Zielkugel hat –
 * und zwar einen Punkt für jede eigene Kugel, die näher liegt als die beste
 * Kugel aller Mitspieler.
 */
export function scoreRound(
  jack: Point,
  ballsByPlayer: { playerId: string; balls: Point[] }[]
): PlayerScore[] {
  const scores: PlayerScore[] = ballsByPlayer.map(({ playerId, balls }) => ({
    playerId,
    points: 0,
    distances: balls
      .map(b => Math.hypot(b.x - jack.x, b.y - jack.y))
      .sort((a, b) => a - b),
  }));

  const withBalls = scores.filter(s => s.distances.length > 0);
  if (withBalls.length === 0) return scores;

  const leader = withBalls.reduce((best, s) =>
    s.distances[0] < best.distances[0] ? s : best
  );
  const bestOpponent = Math.min(
    ...withBalls
      .filter(s => s.playerId !== leader.playerId)
      .map(s => s.distances[0]),
    Infinity
  );
  leader.points = leader.distances.filter(d => d < bestOpponent).length;

  return scores;
}
