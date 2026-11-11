// The Explore layers: finished, anonymous aggregates built by Pulsus and
// copied here (npm run sync-data). Only totals by region and size; no
// institution's identity or figures, and none of the method that read them.

import usBanks from "./data/us-banks.json";
import euBanks from "./data/eu-banks.json";
import coBanks from "./data/co-banks.json";
import usCreditUnions from "./data/us-credit-unions.json";
import coInsurers from "./data/co-insurers.json";
import usGovernment from "./data/us-government.json";
import type { AtlasLayer } from "./layers";
import { LAYERS } from "./catalog";
import { exploreAt, type ExploreData } from "./explore";

const BY_ID: Record<string, unknown> = {
  "us-banks": usBanks, "eu-banks": euBanks, "co-banks": coBanks,
  "us-credit-unions": usCreditUnions, "co-insurers": coInsurers, "us-government": usGovernment,
};

export const ALL_LAYERS: AtlasLayer[] = LAYERS.map((d) => BY_ID[d.id] as AtlasLayer).filter(Boolean);

/** Everyone gets everything: Explore is free and needs no account. */
export const exploreData = (): ExploreData => exploreAt(ALL_LAYERS, "full");
