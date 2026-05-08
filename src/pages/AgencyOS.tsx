// AgencyOS — single-page host for the four Marina surfaces (Dashboard, Inbox,
// Calendar, Portfolio). Wrapped by AgencyRoute in App.tsx so only signed-in
// users with role `agency_manager` (or `admin` for self-test) can reach it.
//
// Mock data only this pass; see `docs/agency-os-data-wireup.md` for the
// follow-up plan to swap each section onto Supabase.

import { useState } from 'react';
import AgencyShell, { SurfaceId } from '@/components/agency-os/AgencyShell';
import Dashboard from '@/components/agency-os/surfaces/Dashboard';
import Inbox from '@/components/agency-os/surfaces/Inbox';
import Calendar from '@/components/agency-os/surfaces/Calendar';
import Portfolio from '@/components/agency-os/surfaces/Portfolio';
import type { Density, Scenario } from '@/lib/agency-os/data';

export default function AgencyOS() {
  const [surface, setSurface] = useState<SurfaceId>('dashboard');
  const scenario: Scenario = 'typical';
  const density: Density = 'comfortable';

  return (
    <AgencyShell
      surface={surface}
      scenario={scenario}
      density={density}
      onNav={setSurface}
    >
      {surface === 'dashboard' && (
        <Dashboard scenario={scenario} density={density} onNav={setSurface} />
      )}
      {surface === 'inbox' && <Inbox scenario={scenario} />}
      {surface === 'calendar' && <Calendar scenario={scenario} />}
      {surface === 'portfolio' && <Portfolio scenario={scenario} />}
    </AgencyShell>
  );
}
