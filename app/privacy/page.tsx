import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · Pulsus Explore" };

// Plain and short, because there is little to say: Explore collects nothing.
export default function Privacy() {
  return (
    <main className="pz pz-xp-page"><div className="pz-main pz-xp-main" style={{ maxWidth: 720 }}>
      <p className="pz-eyebrow"><a className="pz-link-btn" href="/">← Explore</a></p>
      <h1>Privacy</h1>
      <p className="pz-muted">Last updated 11 November 2026.</p>
      <h2 className="pz-h3">What Pulsus <span style={{ color: "#ff2d55" }}>Explore</span> collects</h2>
      <p>Nothing, unless you subscribe. Explore has no accounts, no sign-in, no advertising and no analytics or tracking. It does not read your contacts, location or anything else on your device.</p>
      <h2 className="pz-h3">If you subscribe for updates</h2>
      <p>Subscribing asks only for your email address. It goes to Pulsus Platform, is stored encrypted, and is used only to send you updates about Pulsus Explore and Pulsus Platform. It is never sold or shared. To unsubscribe or have it deleted, reply to any update or contact us (below), and we will remove it.</p>
      <h2 className="pz-h3">What is stored on your device</h2>
      <p>Your light or dark theme choice, and a copy of the app and its public figures so it opens without a connection. Both stay on your device; clearing the app&apos;s data removes them.</p>
      <h2 className="pz-h3">What our servers see</h2>
      <p>Like any website, our hosting provider receives standard technical request information (such as IP address and browser type) to deliver the pages and protect the service. We do not use it to identify or profile you.</p>
      <h2 className="pz-h3">The figures</h2>
      <p>Explore shows aggregated readings of institutions&apos; public financial and operational data, published by regulators and governments. No institution is named and groups too small to keep anonymous are hidden.</p>
      <h2 className="pz-h3">Contact</h2>
      <p>Tumblehill Holdings LLC · <a className="pz-link-btn" href="https://about.pulsus.tech">about.pulsus.tech</a></p>
    </div></main>
  );
}
