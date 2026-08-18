import Profile from './Profile';

/**
 * QR business card (design@2026-07-30, amended by the owner-directed collapse of 2026-08-17).
 *
 * ONE SCAN, ONE PAGE, BOTH PARTNERS. There is nothing to resolve here any more. This
 * component used to read a `?profile=` query parameter, resolve it to Zachary, Ethaniel, or
 * an unresolved-card firm fallback, keep that key in sync with back/forward navigation, and
 * render a development-only preview bar for switching between the three. All of it is gone,
 * because a page that shows both partners has nothing to select between.
 *
 * WHY THAT ALSO REMOVED THE DEV PREVIEW BAR. Its whole job was choosing among the three
 * states. It also listed dev-only fixtures for the approved missing-data states, which the
 * owner-confirmed phone and email values no longer reach.
 *
 * There is still no router, and still for the original reason: the permanent public profile
 * URL is an unresolved owner decision, printed on a physical card and unrevisable after
 * printing, so this app must not establish a routing contract by shipping one. The collapse
 * makes that easier to honour, not harder. One page needs one address.
 */
export default function App() {
  return <Profile />;
}
