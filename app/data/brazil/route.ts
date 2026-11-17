// The Brazil layers as Explore publishes them, in full and machine-readable: a
// Derivative Database of the Banco Central do Brasil's IF.data, offered to
// everyone under the Open Database License 1.0 (ODbL 4.4 and 4.6), with its notice.
// Anonymous totals only, exactly as the app receives them.
import brBanks from "../../../lib/atlas/data/br-banks.json";
import brCreditCoops from "../../../lib/atlas/data/br-credit-coops.json";

export const dynamic = "force-static";

export function GET() {
  const { licence } = brBanks;
  return Response.json({
    licence: { ...licence, terms: "This database is made available under the Open Database License: https://opendatacommons.org/licenses/odbl/1-0/." },
    layers: [brBanks, brCreditCoops],
  }, { headers: { "Content-Disposition": "inline; filename=\"pulsus-explore-brazil.json\"" } });
}
