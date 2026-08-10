import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn (className-Helfer)", () => {
  it("verbindet Klassen", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignoriert falsy Werte", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("löst Tailwind-Konflikte auf (letzte gewinnt)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
