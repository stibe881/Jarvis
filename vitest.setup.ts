// Erweitert `expect` um DOM-Matcher (toBeInTheDocument, toHaveAttribute, ...).
// Harmlos für Node-Tests: registriert nur zusätzliche Matcher.
import "@testing-library/jest-dom/vitest";
