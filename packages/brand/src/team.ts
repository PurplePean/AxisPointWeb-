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
      'Zachary joined AxisPoint Partners after years of working directly in Texas commercial real estate acquisitions and asset management. He studied Mathematics and Computer Science before moving into a family office where he worked his way from multifamily analyst to running the asset management department, responsible for full business plan development and execution across the portfolio.',
      'His focus is multifamily, specifically Class B and C workforce housing in primary and secondary Texas markets. He has worked deals and managed assets across Houston, Dallas-Fort Worth, Austin, San Antonio, Lubbock, and Midland, not from a desk, but on the ground, managing property management teams, holding vendors accountable, and making the operational decisions that directly affect NOI. Zachary underwrites every deal the same way he manages them: from the ground up, stress-tested, with no best-case assumptions.',
      'AxisPoint was built on the belief that individual investors and family offices deserve the same quality of asset management that institutional capital has always had access to. Zachary brings that standard to every engagement, regardless of portfolio size.',
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
      'Ethaniel joined AxisPoint Partners after building his career across investment sales and third-party asset management for private owners and private capital groups in the Houston and Dallas-Fort Worth markets. His experience spans the full deal lifecycle from the transaction side, understanding how assets are valued and traded, to the operational side, managing properties on behalf of owners who needed someone accountable for results.',
      'His focus is commercial asset management across all major asset classes including industrial, retail, office, and NNN. He brings extensive leasing experience, particularly in NNN structures, and a deep understanding of how different tenant types operate and what drives their long-term occupancy decisions. Ethaniel manages every asset the same way he learned to manage them as a third-party operator: as if his name is on the outcome.',
      'AxisPoint was built on the belief that private owners deserve the same level of commercial asset management that institutional capital has always had access to. Ethaniel brings that standard to every engagement, across every asset class, regardless of portfolio size.',
    ],
  },
};

// Helper functions
export const getTeamMember = (id: TeamMember['id']): TeamMember => team[id];
export const getAllTeamMembers = (): TeamMember[] => Object.values(team);
export const getTeamMemberByEmail = (email: string): TeamMember | undefined =>
  Object.values(team).find((member) => member.email === email);
