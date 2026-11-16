// How many organisations stand behind a group's average, in four plain bands.
// One rule for every average Explore shows: a place's median on the map and
// its cards, a directory row, the regulatory indicators' medians, and the
// Operational Health medians. Pure, so it is tested directly
// (tests/bands.test.mjs).
//
//   1–9    no average: only the count ("6 banks — too few for an average")
//   10–19  the average, as a limited sample: never ranked or compared
//   20–49  the average, moderate confidence
//   50+    the average, broader coverage
//
// Rankings, movers, areas to watch, peer comparisons and "highest/lowest
// first" orderings need RANK_MIN or more. No group below SHOW_MIN ever shows a
// figure, so no single institution can be identified.

/** The fewest organisations a group needs for its average to be shown. */
export const SHOW_MIN = 10;
/** The fewest for a group to be ranked or compared with others. */
export const RANK_MIN = 20;
/** The fewest for "broader coverage". */
export const BROAD_MIN = 50;

export type Band = "insufficient" | "limited" | "moderate" | "broad";
export const BAND_LABEL: Record<Band, string> = {
  insufficient: "Insufficient data",
  limited: "Limited sample",
  moderate: "Moderate confidence",
  broad: "Broader coverage",
};

export const bandOf = (n: number): Band => (n >= BROAD_MIN ? "broad" : n >= RANK_MIN ? "moderate" : n >= SHOW_MIN ? "limited" : "insufficient");
/** May the group's average be shown? */
export const canShow = (n: number) => n >= SHOW_MIN;
/** May the group be ranked, or compared with others? */
export const canRank = (n: number) => n >= RANK_MIN;
/** The class a group is drawn with on the map: too few, a limited sample, or plain. */
export const bandClass = (n: number) => (n < SHOW_MIN ? "is-few" : n < RANK_MIN ? "is-limited" : "");

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
/** The label beside an average: "Limited sample · 14 institutions"; below SHOW_MIN,
 *  the count alone: "6 institutions — too few for an average". */
export function sampleText(n: number, many = "institutions", one = "institution"): string {
  return canShow(n) ? `${BAND_LABEL[bandOf(n)]} · ${count(n, one, many)}` : `${count(n, one, many)} — too few for an average`;
}

/** An ordering that ranks: the groups with RANK_MIN or more first, by `by`;
 *  then the limited samples, A to Z by `name` (shown, never ranked). */
export function rankedFirst<T>(rows: T[], n: (r: T) => number, by: (a: T, b: T) => number, name: (r: T) => string): T[] {
  const ranked = rows.filter((r) => canRank(n(r))).sort(by);
  const rest = rows.filter((r) => !canRank(n(r))).sort((a, b) => name(a).localeCompare(name(b)));
  return [...ranked, ...rest];
}
