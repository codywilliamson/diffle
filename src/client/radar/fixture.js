// combined ?radar-demo=1 fixture: a demo diff plus its client-only radar analysis. loaded
// lazily by useRadar so nothing here runs on a normal (non-demo) launch.
import { FIXTURE_DIFF, FIXTURE_COMMENTS, FIXTURE_VIEWED } from "/radar/fixtureDiff.js";
import { FIXTURE_UNITS, FIXTURE_META } from "/radar/fixtureUnits.js";

export const RADAR_FIXTURE = {
  diff: FIXTURE_DIFF,
  comments: FIXTURE_COMMENTS,
  viewed: FIXTURE_VIEWED,
  radar: { meta: FIXTURE_META, units: FIXTURE_UNITS },
};
