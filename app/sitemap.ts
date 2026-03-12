import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "/",
    "/adressandring",
    "/dashboard",
    "/om",
    "/anvandarvillkor",
    "/integritetspolicy",
    "/cookiepolicy",
  ];

  return pages.map((path) => ({
    url: absoluteUrl(path),
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/adressandring" ? 0.9 : 0.6,
  }));
}
