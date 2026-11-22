export * from './schema';

// Re-export schema namespace for convenience
export {
  companies,
  users,
  roles,
  memberships,
  agents,
  skills,
  positions,
  departments,
  projects,
  projectTasks,
  governanceRecords,
} from './schema';

export type {
  Company,
  NewCompany,
  User,
  NewUser,
  Role,
  NewRole,
  Membership,
  NewMembership,
  Agent,
  NewAgent,
  Skill,
  NewSkill,
  Position,
  NewPosition,
  Department,
  NewDepartment,
  Project,
  NewProject,
  ProjectTask,
  NewProjectTask,
  GovernanceRecord,
  NewGovernanceRecord,
} from './schema';
