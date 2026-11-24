import { ImageResponse } from "next/og";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

// The card shown when Explore is shared: its night logo and what it is.
export const alt = "Pulsus Explore";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logo = `data:image/png;base64,${await readFile(join(process.cwd(), "public/pulsus-explore-logo-night.png"), "base64")}`;

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0f2c", padding: "64px 72px", color: "#eef1ff" }}>
        <img src={logo} width={441} height={120} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, letterSpacing: 6, color: "#ff4f6d", textTransform: "uppercase", marginBottom: 18 }}>Free · public data</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Pulsus Explore</div>
          <div style={{ fontSize: 30, color: "#c6cae3", marginTop: 22 }}>A free window on the world&apos;s sectors, read from public data.</div>
        </div>
        <div style={{ display: "flex", height: 10, borderRadius: 5, background: "linear-gradient(90deg, #ff4f6d, #f5b947, #3ddc97)" }} />
      </div>
    ),
    size,
  );
}
