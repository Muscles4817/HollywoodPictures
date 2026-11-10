// The home-entertainment window ends a theatrical run's tail
// (docs/domain/09-marketing-and-distribution.md §7.4: the exclusive theatrical
// period is now typically 17-45 days to PVOD; docs/domain/10 §2;
// docs/DESIGN_REVIEW_box_office_variance_diagnosis.md §10.2, §11).
//
// Once a film's home release is near, part of its still-interested audience
// simply waits for it. Without this the simulation had nothing ending a slow
// run: every Limited and Festival First release hit the 20-week cap still
// taking a third or more of its peak week. Wide films have drained their pool
// long before this bites, so it barely touches them.

/** Weeks of exclusive theatrical play before the waiting starts (~45 days, the long end of today's window). */
export const HOME_WINDOW_WEEKS = 6;
/** Share of the remaining interested audience that decides to wait for home release each week after that. */
export const HOME_WINDOW_WEEKLY_ATTRITION = 0.25;
