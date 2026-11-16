import { ImageResponse } from "next/og";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

// The card shown when /technology is shared: Explore's night logo and the page's title.
export const alt = "How Pulsus Explore works";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logo = `data:image/png;base64,${await readFile(join(process.cwd(), "public/pulsus-explore-logo-night.png"), "base64")}`;

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0f2c", padding: "64px 72px", color: "#eef1ff" }}>
        <img src={logo} width={441} height={120} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, letterSpacing: 6, color: "#ff4f6d", textTransform: "uppercase", marginBottom: 18 }}>Technology</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>How Pulsus Explore works</div>
          <div style={{ fontSize: 30, color: "#c6cae3", marginTop: 22 }}>The data, the score, how it is checked, and privacy.</div>
        </div>
        <div style={{ display: "flex", height: 10, borderRadius: 5, background: "linear-gradient(90deg, #ff4f6d, #f5b947, #3ddc97)" }} />
      </div>
    ),
    size,
  );
}
