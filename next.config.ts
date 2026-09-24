import type { NextConfig } from "next";

// CAPACITOR_BUILD=1 genera un export estático en /out que Capacitor envuelve para iOS/Android.
// En Vercel se usa el build normal de Next.js.
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
