// Next.js 16 ships a native ESLint flat config in eslint-config-next/dist/index.
// Spread it here; add project-specific overrides afterward.
import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
      ".next/types/**",
    ],
  },
  {
    rules: {
      // The studio renders user-supplied assets from `public/generations/`
      // which next/image's loader can't optimize anyway; <img> is the
      // pragmatic choice here. Turn off the warning project-wide rather
      // than scattering inline disables.
      "@next/next/no-img-element": "off",
      // react-hooks v7 introduced several new error-level rules that flag
      // legitimate-but-discouraged patterns (data fetching, derived state,
      // ref mutation in render, etc.). The codebase pre-dates them; rather
      // than rewrite working code in this OSS prep pass, downgrade to
      // warnings and treat them as tech debt. See CONTRIBUTING.md.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default config;
