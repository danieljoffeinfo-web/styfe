/**
 * What loose date entry accepts, asserted. Run with `npm run check:dates`.
 *
 * Fixed at a known Wednesday rather than the real clock, so "next friday" and
 * the year inference mean the same thing every time it runs.
 */
import { parseLooseDate } from "@/lib/parse-date";

const TODAY = "2026-09-30"; // a Wednesday
const cases: [string, string | null][] = [
  ["8 oct", "2026-10-08"],
  ["8th October", "2026-10-08"],
  ["8 October 2026", "2026-10-08"],
  ["oct 8", "2026-10-08"],
  ["October 8th", "2026-10-08"],
  ["8 oct 26", "2026-10-08"],
  ["8 oct 2027", "2027-10-08"],
  ["8/10", "2026-10-08"],
  ["08/10/2026", "2026-10-08"],
  ["8.10.26", "2026-10-08"],
  ["8-10", "2026-10-08"],
  ["2026-10-08", "2026-10-08"],
  ["today", "2026-09-30"],
  ["tomorrow", "2026-10-01"],
  ["yesterday", "2026-09-29"],
  ["+7", "2026-10-07"],
  ["in 14 days", "2026-10-14"],
  ["30d", "2026-10-30"],
  ["-3", "2026-09-27"],
  ["8", "2026-10-08"],
  ["8th", "2026-10-08"],
  ["30", "2026-09-30"],
  ["friday", "2026-10-02"],
  ["fri", "2026-10-02"],
  ["next friday", "2026-10-09"],
  ["last friday", "2026-09-25"],
  ["monday", "2026-10-05"],
  ["15 sep", "2026-09-15"],
  ["8 jan", "2027-01-08"],
  ["29 feb", null],
  ["31 feb", null],
  ["32 oct", null],
  ["banana", null],
  ["", null],
  ["oct", null],
  ["13/13", null],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = parseLooseDate(input, TODAY);
  const pass = got === expected;
  if (!pass) failed += 1;
  console.log(`${pass ? "pass" : "FAIL"}  ${JSON.stringify(input).padEnd(16)} -> ${got}${pass ? "" : `   expected ${expected}`}`);
}

// A leap year still has a 29 February.
const leap = parseLooseDate("29 feb", "2028-01-01");
if (leap !== "2028-02-29") { console.log(`FAIL  29 feb in a leap year -> ${leap}`); failed += 1; }
else console.log("pass  29 feb in a leap year -> 2028-02-29");

// December rollover: "8 jan" typed in December means next January.
const dec = parseLooseDate("8 jan", "2026-12-15");
if (dec !== "2027-01-08") { console.log(`FAIL  8 jan from December -> ${dec}`); failed += 1; }
else console.log("pass  8 jan from December -> 2027-01-08");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
