import ExploreApp from "../components/ExploreApp";
import { exploreData } from "../lib/atlas/serve";

// Built once: the same public figures for every visitor, served from the edge
// and cached by the app for offline use.
export const dynamic = "force-static";

export default function Home() {
  return <ExploreApp data={exploreData()} platformUrl={process.env.NEXT_PUBLIC_PLATFORM_URL || null} />;
}
