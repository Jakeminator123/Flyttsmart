import { absoluteUrl, siteConfig } from "@/lib/site-config";

interface FaqEntry {
  question: string;
  answer: string;
}

export function createOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl("/media/logos/logo-full.svg"),
    email: siteConfig.email,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: siteConfig.email,
        availableLanguage: ["sv", "en"],
        areaServed: "SE",
      },
    ],
  };
}

export function createWebsiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: siteConfig.language,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
    },
  };
}

export function createServiceStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Digital flyttanmälan och flyttstöd",
    serviceType: "Flyttanmälan, checklista och uppföljning vid flytt",
    provider: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    areaServed: {
      "@type": "Country",
      name: "Sweden",
    },
    availableLanguage: ["sv-SE"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "SEK",
      availability: "https://schema.org/InStock",
      url: absoluteUrl("/adressandring"),
    },
  };
}

export function createFaqStructuredData(entries: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}
