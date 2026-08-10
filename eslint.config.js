import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Pragmatische ESLint-Flat-Config.
 *
 * Ziel: echte Fehler fangen (ungenutzte Variablen, offensichtliche Bugs, falsche
 * Hook-Nutzung), ohne die bestehende Codebasis mit Hunderten Alt-Warnungen zu
 * blockieren. Stilfragen bleiben bei Prettier. Rauschige Regeln stehen bewusst
 * auf "warn", damit `pnpm lint` in CI nicht an Altlasten scheitert.
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "drizzle/meta/**",
      "patches/**",
      "client/src/components/ui/**", // generierte shadcn/ui-Komponenten
      "*.config.js",
      "*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript prüft undefinierte Bezeichner bereits selbst – die reine
      // JS-Regel erzeugt für Browser-/Node-Globals nur Rauschen.
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-this-alias": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-useless-assignment": "warn",
      "no-misleading-character-class": "warn",
    },
  },
  {
    files: ["client/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Nur die bewährten Klassiker erzwingen. Die aggressiven React-Compiler-
      // Regeln aus react-hooks v7 (set-state-in-effect, immutability, purity)
      // würden die bestehende Client-Codebasis mit Altlasten blockieren; sie
      // können später gezielt aktiviert werden.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Node-Globals für Server-/Config-Dateien.
    files: ["server/**/*.ts", "*.ts"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", Buffer: "readonly" },
    },
  }
);
