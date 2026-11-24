// Structured data for Explore's own pages: what the page is, and that it is part
// of Pulsus Explore (https://explore.pulsus.tech/), made by Tumblehill Labs.
export default function PageLd({ path, name, description }: { path: string; name: string; description: string }) {
  const url = `https://explore.pulsus.tech${path}`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", "@id": "https://explore.pulsus.tech/#website", name: "Pulsus Explore", url: "https://explore.pulsus.tech/" },
    about: { "@id": "https://explore.pulsus.tech/#app" },
    publisher: { "@type": "Organization", "@id": "https://about.pulsus.tech/#org", name: "Tumblehill Labs", url: "https://about.pulsus.tech/" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}
