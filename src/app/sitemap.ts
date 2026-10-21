import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

const PAGES = ["", "/pricing", "/registro", "/login", "/soporte", "/legal/privacidad", "/legal/terminos"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: `${SITE_URL}${path}`, priority: path ? 0.6 : 1 }));
}
