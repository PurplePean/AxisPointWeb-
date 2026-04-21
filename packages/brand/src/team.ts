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
      // Bio paragraphs will be added based on prototype content
      'Placeholder bio paragraph 1.',
      'Placeholder bio paragraph 2.',
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
      // Bio paragraphs will be added based on prototype content
      'Placeholder bio paragraph 1.',
      'Placeholder bio paragraph 2.',
    ],
  },
};

// Helper functions
export const getTeamMember = (id: TeamMember['id']): TeamMember => team[id];
export const getAllTeamMembers = (): TeamMember[] => Object.values(team);
export const getTeamMemberByEmail = (email: string): TeamMember | undefined =>
  Object.values(team).find((member) => member.email === email);
