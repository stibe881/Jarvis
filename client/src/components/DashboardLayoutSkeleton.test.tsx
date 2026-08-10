import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

/**
 * Erster Client-/React-Test: belegt, dass die jsdom-Test-Infrastruktur steht
 * (zuvor liefen Tests ausschließlich serverseitig in Node).
 */
describe("DashboardLayoutSkeleton", () => {
  afterEach(() => cleanup());

  it("rendert ohne Fehler und zeigt Skeleton-Platzhalter", () => {
    const { container } = render(<DashboardLayoutSkeleton />);
    // Die Skeleton-Komponente markiert Platzhalter mit data-slot="skeleton".
    const placeholders = container.querySelectorAll('[data-slot="skeleton"]');
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it("nutzt die volle Bildschirmhöhe (min-h-screen)", () => {
    const { container } = render(<DashboardLayoutSkeleton />);
    expect(container.querySelector(".min-h-screen")).not.toBeNull();
  });
});
