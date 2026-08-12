import { describe, expect, it } from "vitest";
import {
  detectScene,
  findBlobs,
  looksRound,
  matchesBallColor,
  matchesJackColor,
  rgbToHsv,
  scoreRound,
  BALL_COLORS,
  type PixelSource,
} from "./bocciaVision";

describe("rgbToHsv", () => {
  it("wandelt Grundfarben korrekt um", () => {
    expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 1, v: 1 });
    expect(rgbToHsv(0, 255, 0).h).toBe(120);
    expect(rgbToHsv(0, 0, 255).h).toBe(240);
    expect(rgbToHsv(255, 255, 255)).toEqual({ h: 0, s: 0, v: 1 });
    expect(rgbToHsv(0, 0, 0)).toEqual({ h: 0, s: 0, v: 0 });
  });
});

describe("Farbklassifikation", () => {
  const def = (key: string) => BALL_COLORS.find(c => c.key === key)!;

  it("erkennt Rot auch über den 0°-Umbruch hinweg", () => {
    expect(matchesBallColor(rgbToHsv(220, 30, 40), def("rot"))).toBe(true);
    expect(matchesBallColor(rgbToHsv(200, 20, 60), def("rot"))).toBe(true); // h ≈ 347°
    expect(matchesBallColor(rgbToHsv(30, 30, 220), def("rot"))).toBe(false);
  });

  it("erkennt Blau und weist Grau zurück", () => {
    expect(matchesBallColor(rgbToHsv(40, 90, 220), def("blau"))).toBe(true);
    expect(matchesBallColor(rgbToHsv(128, 128, 140), def("blau"))).toBe(false);
  });

  it("erkennt eine weisse Zielkugel nur bei hellen, ungesättigten Pixeln", () => {
    expect(matchesJackColor(rgbToHsv(245, 245, 240), "weiss")).toBe(true);
    expect(matchesJackColor(rgbToHsv(120, 120, 120), "weiss")).toBe(false);
    expect(matchesJackColor(rgbToHsv(255, 220, 150), "weiss")).toBe(false);
  });
});

describe("findBlobs", () => {
  it("gruppiert zusammenhängende Pixel und berechnet den Schwerpunkt", () => {
    // 6x4-Maske mit einem 2x2-Block bei (1,1) und einem Einzelpixel bei (4,3)
    const width = 6;
    const height = 4;
    const mask = new Uint8Array(width * height);
    mask[1 * width + 1] = 1;
    mask[1 * width + 2] = 1;
    mask[2 * width + 1] = 1;
    mask[2 * width + 2] = 1;
    mask[3 * width + 4] = 1;

    const blobs = findBlobs(mask, width, height, 2);
    expect(blobs).toHaveLength(1); // Einzelpixel fällt unter die Mindestfläche
    expect(blobs[0].area).toBe(4);
    expect(blobs[0].x).toBeCloseTo(1.5);
    expect(blobs[0].y).toBeCloseTo(1.5);
  });

  it("trennt nicht verbundene Flächen", () => {
    const width = 8;
    const height = 3;
    const mask = new Uint8Array(width * height);
    for (const x of [0, 1]) for (const y of [0, 1]) mask[y * width + x] = 1;
    for (const x of [5, 6]) for (const y of [1, 2]) mask[y * width + x] = 1;
    expect(findBlobs(mask, width, height, 2)).toHaveLength(2);
  });
});

describe("looksRound", () => {
  it("akzeptiert kompakte Flächen und verwirft dünne Linien", () => {
    expect(looksRound({ x: 0, y: 0, area: 12, width: 4, height: 4 })).toBe(
      true
    );
    expect(looksRound({ x: 0, y: 0, area: 20, width: 20, height: 1 })).toBe(
      false
    );
  });
});

/** Kleines synthetisches Bild mit einfarbigen Quadraten erzeugen */
function makeImage(
  width: number,
  height: number,
  squares: {
    x: number;
    y: number;
    size: number;
    rgb: [number, number, number];
  }[]
): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  // Hintergrund: dunkelgrau
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 40;
    data[i * 4 + 1] = 42;
    data[i * 4 + 2] = 45;
    data[i * 4 + 3] = 255;
  }
  for (const sq of squares) {
    for (let dy = 0; dy < sq.size; dy++) {
      for (let dx = 0; dx < sq.size; dx++) {
        const o = ((sq.y + dy) * width + (sq.x + dx)) * 4;
        data[o] = sq.rgb[0];
        data[o + 1] = sq.rgb[1];
        data[o + 2] = sq.rgb[2];
      }
    }
  }
  return { data, width, height };
}

describe("detectScene", () => {
  it("findet Zielkugel und Spielerkugeln in einem synthetischen Bild", () => {
    const image = makeImage(80, 60, [
      { x: 38, y: 28, size: 4, rgb: [250, 250, 248] }, // Zielkugel weiss
      { x: 10, y: 10, size: 6, rgb: [220, 30, 40] }, // rot
      { x: 60, y: 40, size: 6, rgb: [40, 90, 220] }, // blau
      { x: 20, y: 44, size: 6, rgb: [220, 30, 40] }, // rot
    ]);

    const result = detectScene(image, {
      ballColors: ["rot", "blau"],
      jackColor: "weiss",
      maxBallsPerColor: 4,
      minArea: 4,
    });

    expect(result.jack).not.toBeNull();
    expect(result.jack!.x).toBeCloseTo(39.5);
    expect(result.jack!.y).toBeCloseTo(29.5);
    expect(result.balls.rot).toHaveLength(2);
    expect(result.balls.blau).toHaveLength(1);
  });

  it("zweigt bei geteilter Farbe die kleinste Kugel als Zielkugel ab", () => {
    const image = makeImage(80, 60, [
      { x: 40, y: 30, size: 3, rgb: [230, 190, 40] }, // kleine gelbe Zielkugel
      { x: 10, y: 10, size: 7, rgb: [230, 190, 40] }, // grosse gelbe Spielerkugel
    ]);

    const result = detectScene(image, {
      ballColors: ["gelb"],
      jackColor: "gelb",
      maxBallsPerColor: 4,
      minArea: 4,
    });

    expect(result.jack).not.toBeNull();
    expect(result.jack!.area).toBeLessThan(result.balls.gelb![0].area);
    expect(result.balls.gelb).toHaveLength(1);
  });
});

describe("scoreRound", () => {
  const jack = { x: 0, y: 0 };

  it("gibt dem Spieler mit der nähesten Kugel einen Punkt je bessere Kugel", () => {
    const scores = scoreRound(jack, [
      {
        playerId: "anna",
        balls: [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 9, y: 0 },
        ],
      },
      { playerId: "ben", balls: [{ x: 3, y: 0 }] },
    ]);

    expect(scores.find(s => s.playerId === "anna")!.points).toBe(2);
    expect(scores.find(s => s.playerId === "ben")!.points).toBe(0);
  });

  it("wertet alle Kugeln, wenn kein Mitspieler Kugeln im Bild hat", () => {
    const scores = scoreRound(jack, [
      {
        playerId: "anna",
        balls: [
          { x: 1, y: 0 },
          { x: 5, y: 0 },
        ],
      },
      { playerId: "ben", balls: [] },
    ]);

    expect(scores.find(s => s.playerId === "anna")!.points).toBe(2);
  });

  it("liefert bei drei Spielern nur Punkte für den Führenden", () => {
    const scores = scoreRound(jack, [
      { playerId: "a", balls: [{ x: 4, y: 0 }] },
      {
        playerId: "b",
        balls: [
          { x: 1, y: 0 },
          { x: 3, y: 0 },
        ],
      },
      { playerId: "c", balls: [{ x: 2, y: 0 }] },
    ]);

    expect(scores.find(s => s.playerId === "b")!.points).toBe(1);
    expect(scores.find(s => s.playerId === "a")!.points).toBe(0);
    expect(scores.find(s => s.playerId === "c")!.points).toBe(0);
  });

  it("gibt ohne Kugeln überall null Punkte", () => {
    const scores = scoreRound(jack, [
      { playerId: "a", balls: [] },
      { playerId: "b", balls: [] },
    ]);
    expect(scores.every(s => s.points === 0)).toBe(true);
  });
});
