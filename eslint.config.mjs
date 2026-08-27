import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules — KEEP THESE ON. The previous config disabled
    // no-unused-vars and no-explicit-any which allowed bugs to slip through.
    // Re-enabled for code quality. Remaining "off" rules are intentional
    // for this project's patterns (e.g. no-non-null-assertion for Prisma).

    // React rules
    "react-hooks/exhaustive-deps": "warn", // was "off" — warn on missing deps
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules — re-enabled critical ones
    "prefer-const": "warn", // was "off"
    "no-console": "off", // allow console for dev logging
    "no-debugger": "warn", // was "off"
    "no-empty": "warn", // was "off"
    "no-unreachable": "error", // was "off" — dead code after return
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "warn", // was "off"
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "error", // was "off"
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"]
}];

export default eslintConfig;
