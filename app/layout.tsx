import type { Metadata, Viewport } from "next";
import "./explore.css";

export const metadata: Metadata = {
  title: "Pulsus Platform · Explore",
  description: "A free window on the world's sectors: the health of banks, credit unions, insurers and government agencies, read from public data. Aggregated; no institution is named.",
  applicationName: "Pulsus Platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pulsus" },
  icons: { icon: [{ url: "/icon-192.png", type: "image/png" }], apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a0f2c" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f2c" },
  ],
};

// The reader's chosen theme before the first paint.
const THEME = `(function(){var t=null;try{t=localStorage.getItem("pz-theme")}catch(e){}if(t==="light"||t==="dark")document.documentElement.dataset.pzTheme=t})()`;
// Offline support (and what makes it installable as an app).
const SW = `if("serviceWorker"in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body style={{ margin: 0 }}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: SW }} />
      </body>
    </html>
  );
}
