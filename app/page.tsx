import type { Metadata } from "next";
import MapApp, { type World } from "../components/MapApp";
import { exploreData, opsData } from "../lib/atlas/serve";
import world from "../lib/atlas/world.json";
import "./map.css";

// Built once: the same public figures for every visitor, served from the edge
// and cached by the app for offline use. The map fills the screen; everything
// else floats over it (components/MapApp.tsx).
export const dynamic = "force-static";

const TITLE = "Pulsus Platform · Explore";
const DESCRIPTION = "A free window on the world's sectors: the health of banks, credit unions, insurers and government agencies, read from public data. Financial condition by place; Operational Health for named institutions, from regulators' published complaints data.";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", siteName: "Pulsus Explore", title: TITLE, description: DESCRIPTION, locale: "en_GB" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Structured data: what Explore is, that it is free, and who makes it.
// Creator and owner: in the metadata only (search engines and AI read it; visitors never see it).
const CREATOR = { "@type": "Person", "@id": "https://about.pulsus.tech/#creator", name: "Nicola Anderson", jobTitle: "Founder", sameAs: ["https://www.linkedin.com/in/nicolaanderson/"] };

const LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": "https://explore.pulsus.tech/#app",
  name: "Pulsus Explore",
  url: "https://explore.pulsus.tech/",
  description: DESCRIPTION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  isPartOf: { "@type": "WebSite", "@id": "https://about.pulsus.tech/#website", name: "Pulsus Intelligence Suite", url: "https://about.pulsus.tech/" },
  publisher: { "@type": "Organization", "@id": "https://about.pulsus.tech/#org", name: "Tumblehill Labs", url: "https://about.pulsus.tech/", founder: CREATOR, parentOrganization: { "@type": "Organization", name: "Tumblehill Holdings LLC", founder: CREATOR } },
  creator: CREATOR,
  copyrightHolder: { "@type": "Organization", name: "Tumblehill Holdings LLC" },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />
      <MapApp data={exploreData()} world={world as World} ops={opsData()} />
    </>
  );
}
