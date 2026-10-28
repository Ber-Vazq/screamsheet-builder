// Phase 5 rollout switch.
// false = Release A: new sheets and copies save as v1; editing an old (v0)
//         sheet keeps writing the legacy shape.
// true  = Release B: saving an old sheet upgrades its row to v1 (same id,
//         same share link, same GM key).
// Flip with the VITE_UPGRADE_ON_SAVE=true env var in Vercel and redeploy.
// Rolling back = set it to false (or remove it) and redeploy; v1 rows still read fine.
export const UPGRADE_ON_SAVE = import.meta.env.VITE_UPGRADE_ON_SAVE === "true";
