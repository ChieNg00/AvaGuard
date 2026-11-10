import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
const config = [...next, ...ts, {
  settings: { next: { rootDir: "apps/web/" } },
}, { ignores: ["**/.next/**", "**/out/**", "**/cache/**", "**/next-env.d.ts"] }];
export default config;