import type { NextConfig } from "next";

// CAPACITOR_BUILD=1 genera un export estático en /out que Capacitor envuelve para iOS/Android.
// En Vercel se usa el build normal de Next.js. El export se corre con `npm run build:export`
// (scripts/build-export.mjs), que aparta src/app/api porque un export estático no tiene servidor.
const isCapacitor = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  devIndicators: false,
  ...(isCapacitor && {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default nextConfig;
