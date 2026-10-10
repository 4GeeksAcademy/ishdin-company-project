/*
Add these Links to your EXISTING backoffice menu/sidebar.
Do not replace your current navigation component.
*/

import Link from "next/link";

export const IncidentMenuLinks = () => (
  <>
    <Link href="/incidents">Incident Management</Link>
    <Link href="/incidents/new">Register Incident</Link>
  </>
);
