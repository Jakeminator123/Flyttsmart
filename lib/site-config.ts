import type { Metadata } from "next";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const siteConfig = {
  name: "Flytt.io",
  shortName: "Flytt",
  url: configuredSiteUrl && configuredSiteUrl.length > 0
    ? configuredSiteUrl.replace(/\/$/, "")
    : "https://flytt.io",
  description:
    "Flytt.io gör flyttanmälan enklare med BankID, tydliga steg och smart hjälp före, under och efter registreringen.",
  locale: "sv_SE",
  language: "sv-SE",
  email: "info@flytt.io",
  keywords: [
    "flyttanmälan",
    "adressändring",
    "BankID",
    "Skatteverket",
    "flyttchecklista",
    "flytt",
    "flytt.io",
  ],
} as const;

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}

interface PageMetadataOptions {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
}

export function createPageMetadata({
  title,
  description,
  path = "/",
  keywords = [],
}: PageMetadataOptions): Metadata {
  return {
    title,
    description,
    keywords: [...siteConfig.keywords, ...keywords],
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
