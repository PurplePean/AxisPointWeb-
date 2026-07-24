/**
 * AxisPoint Partners Team Data
 * Single source of truth for team member information
 *
 * CRITICAL REQUIREMENTS:
 * - Both titled "Partner" only (not "Managing Partner" or other variants)
 * - NO LinkedIn links
 * - NO headshots - use initials avatars only
 * - Zachary Russell: teal color, initials ZR
 * - Ethaniel Vu: purple color, initials EV
 */

export interface TeamMember {
  id: 'zach' | 'ethaniel';
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  title: 'Partner'; // ONLY "Partner" - never "Managing Partner"
  email: string;
  phone: string;
  color: 'teal' | 'purple';
  bio: string[]; // Array of paragraphs
}

export const team: Record<TeamMember['id'], TeamMember> = {
  zach: {
    id: 'zach',
    firstName: 'Zachary',
    lastName: 'Russell',
    fullName: 'Zachary Russell',
    initials: 'ZR',
    title: 'Partner',
    email: 'zach@axispoint.llc',
    phone: '(832) 580-2815',
    color: 'teal',
    bio: [
      'At AxisPoint, Zachary leads multifamily property operations and performance oversight. His focus is Class B and C workforce housing across Houston and secondary Texas markets, where the daily work of management drives results: standing up management systems, holding property teams and vendors accountable, tracking budgets against plan, and keeping owners informed with clear monthly reporting.',
      'He runs assets on the ground, not from a desk. He has managed properties across Houston, Dallas-Fort Worth, Austin, San Antonio, Lubbock, and Midland, making the operational decisions that directly affect how a property performs. That operating discipline is grounded in the full lifecycle of the asset: Zachary studied Mathematics and Computer Science before working his way through a Texas family office from multifamily analyst to running its asset management department. That acquisitions and underwriting background informs how he operates, but the job is execution.',
      'For owners who want it, Zachary also leads the optional asset management layer, from budgets and capital planning to hold, sell, or refinance strategy. Whether the engagement is property management alone or property management plus strategy, he brings the same standard to every property, regardless of size.',
    ],
  },
  ethaniel: {
    id: 'ethaniel',
    firstName: 'Ethaniel',
    lastName: 'Vu',
    fullName: 'Ethaniel Vu',
    initials: 'EV',
    title: 'Partner',
    email: 'ethaniel@axispoint.llc',
    phone: '(832) 499-8389',
    color: 'purple',
    bio: [
      'At AxisPoint, Ethaniel oversees commercial property management and leasing across industrial, retail, office, and NNN assets throughout Texas. His day-to-day focus is operations: keeping properties well managed and well leased, holding vendors accountable, and reporting clearly to owners. He brings extensive leasing experience, particularly in NNN structures, and a working understanding of how different tenant types operate and what drives their long-term occupancy decisions.',
      'He built that operational depth from both sides of the table. Before AxisPoint, Ethaniel worked across investment sales and third-party management for private owners and private capital groups in the Houston and Dallas-Fort Worth markets, learning how assets are valued and traded as well as how they are run. As a TREC-licensed real estate professional, he manages every property the same way he learned to as a third-party operator: as if his name is on the outcome.',
      'When an owner wants strategy on top of operations, Ethaniel also leads the optional asset management layer for commercial assets. Whether the engagement is property management alone or property management plus strategy, he brings that standard to every property, across every asset class, regardless of size.',
    ],
  },
};

// Helper functions
export const getTeamMember = (id: TeamMember['id']): TeamMember => team[id];
export const getAllTeamMembers = (): TeamMember[] => Object.values(team);
export const getTeamMemberByEmail = (email: string): TeamMember | undefined =>
  Object.values(team).find((member) => member.email === email);
