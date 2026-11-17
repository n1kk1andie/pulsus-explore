// The Explore layers: finished, anonymous aggregates built by Pulsus and
// copied here (npm run sync-data). Only totals by region and size; no
// institution's identity or figures, and none of the method that read them.
// Operational Health is the one exception, by design: named institutions, from
// complaints data their regulators publish by name under an open licence,
// scored by a public formula (lib/atlas/operational.ts, scripts/operational).

import usBanks from "./data/us-banks.json";
import euBanks from "./data/eu-banks.json";
import coBanks from "./data/co-banks.json";
import brBanks from "./data/br-banks.json";
import brCreditCoops from "./data/br-credit-coops.json";
import usCreditUnions from "./data/us-credit-unions.json";
import coInsurers from "./data/co-insurers.json";
import usGovernment from "./data/us-government.json";
import usHospitals from "./data/us-hospitals.json";
import operational from "./data/operational.json";
import type { OpsInstitution } from "./operational";
import { withLimited, type AtlasLayer } from "./layers";
import { LAYERS } from "./catalog";
import { exploreAt, type ExploreData } from "./explore";

const BY_ID: Record<string, unknown> = {
  "us-banks": usBanks, "eu-banks": euBanks, "co-banks": coBanks, "br-banks": brBanks, "br-credit-coops": brCreditCoops,
  "us-credit-unions": usCreditUnions, "co-insurers": coInsurers, "us-government": usGovernment, "us-hospitals": usHospitals,
};

// Groups of 10–19 are opened here, on the server, as limited samples; 1–9 keep only their count.
export const ALL_LAYERS: AtlasLayer[] = LAYERS.map((d) => BY_ID[d.id] as AtlasLayer).filter(Boolean).map(withLimited);

/** Everyone gets everything: Explore is free and needs no account. */
export const exploreData = (): ExploreData => exploreAt(ALL_LAYERS, "full");

/** Operational Health: the named institutions and their published complaints figures. */
export const opsData = () => ({ institutions: operational.institutions as OpsInstitution[], built: operational.built });
