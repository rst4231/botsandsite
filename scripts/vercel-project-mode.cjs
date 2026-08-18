const SPB_PROJECT_ID = 'prj_tg663wlSXTaoE2HNfekiymY0IF63';
const TRAFFIC_PROJECT_ID = 'prj_oeVaHSb17REkd4rZGsJrRIybPRG7';
const RUDI_COMMIT_PREFIX = '[rudi]';

function isRudiProject(projectId = process.env.VERCEL_PROJECT_ID) {
  return projectId === SPB_PROJECT_ID;
}

function shouldIgnoreDeployment(projectId = process.env.VERCEL_PROJECT_ID, commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE || '') {
  const isRudiCommit = String(commitMessage).trim().toLowerCase().startsWith(RUDI_COMMIT_PREFIX);
  if (projectId === SPB_PROJECT_ID) return !isRudiCommit;
  if (projectId === TRAFFIC_PROJECT_ID) return isRudiCommit;
  return false;
}

module.exports = {
  SPB_PROJECT_ID,
  TRAFFIC_PROJECT_ID,
  RUDI_COMMIT_PREFIX,
  isRudiProject,
  shouldIgnoreDeployment,
};

if (require.main === module) {
  process.exit(shouldIgnoreDeployment() ? 0 : 1);
}
