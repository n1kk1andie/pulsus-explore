import MapApp, { type World } from "../components/MapApp";
import { exploreData } from "../lib/atlas/serve";
import world from "../lib/atlas/world.json";
import "./map.css";

// Built once: the same public figures for every visitor, served from the edge
// and cached by the app for offline use. The map fills the screen; everything
// else floats over it (components/MapApp.tsx).
export const dynamic = "force-static";

export default function Home() {
  return <MapApp data={exploreData()} world={world as World} />;
}
