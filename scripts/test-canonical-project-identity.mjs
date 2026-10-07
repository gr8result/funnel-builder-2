// Focused tests for canonical job identity. No network, no live data.
//   node scripts/test-canonical-project-identity.mjs

import {
  canonicalProjectUuid, withCanonicalProjectUuid, projectIdentityPlan,
  findExistingProjectRow, isUuid, newProjectUuid,
} from '../lib/builders/canonicalProjectIdentity.js';

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

const WORKSPACE = '11111111-2222-4333-8444-555555555555';
// The user's actual recovered job, as it exists on disk today.
const recoveredJob = {
  projectId: 'recovered-03-09-123-mtuhwjss',
  jobFileMeta: {
    projectId: 'recovered-03-09-123-mtuhwjss',
    sourceProjectId: '03-09/123',
    jobName: 'New Job 03/09',
    jobNumber: '03-09/123',
    siteAddress: '2 ASTREET, SOMPLACE, QLD, 4557',
  },
  registeredJob: { jobName: 'New Job 03/09', jobNumber: '03-09/123', siteAddress: '2 ASTREET, SOMPLACE, QLD, 4557' },
};

// A — legacy recovered job with no uuid: resolver must say a link/create is needed.
check('A  recovered job has no canonical uuid', canonicalProjectUuid(recoveredJob), null);
const planA = projectIdentityPlan(recoveredJob, { workspaceId: WORKSPACE, existingProjects: [] });
check('A  plan action is create when nothing matches', planA.action, 'create');
check('A  create plan requires approval to write', planA.writeRequired, true);

// B — legacy job carrying a stored canonical uuid: reuse it, never mint a new one.
const linked = withCanonicalProjectUuid(recoveredJob, '99999999-8888-4777-8666-555555555555');
check('B  stored canonical uuid is reused', canonicalProjectUuid(linked), '99999999-8888-4777-8666-555555555555');
check('B  plan reuses it without any write', projectIdentityPlan(linked, { workspaceId: WORKSPACE }).action, 'use-existing');
check('B  display identity is untouched', linked.projectId, 'recovered-03-09-123-mtuhwjss');
check('B  display metadata is untouched', linked.jobFileMeta.projectId, 'recovered-03-09-123-mtuhwjss');

// C/D — reopen and refresh: same object round-tripped through JSON must keep the uuid.
const reopened = JSON.parse(JSON.stringify(linked));
check('C  uuid survives job reopen (JSON round trip)', canonicalProjectUuid(reopened), canonicalProjectUuid(linked));
check('D  uuid unchanged on refresh', projectIdentityPlan(reopened, { workspaceId: WORKSPACE }).uuid, canonicalProjectUuid(linked));

// E — Save As: a copy with a new filename and display name keeps the canonical uuid.
const savedAs = { ...reopened, openedFileName: 'copy-of-job.gr8job', jobFileMeta: { ...reopened.jobFileMeta, jobName: 'New Job 03/09 (copy)' } };
check('E  uuid preserved through Save As', canonicalProjectUuid(savedAs), canonicalProjectUuid(linked));

// F — a normal cloud-backed job whose display id already is a uuid: unchanged behaviour.
const cloudJob = { projectId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', jobFileMeta: {} };
check('F  uuid-backed job resolves to itself', canonicalProjectUuid(cloudJob), 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
check('F  uuid-backed job needs no write', projectIdentityPlan(cloudJob, { workspaceId: WORKSPACE }).action, 'use-existing');

// G — a display id must never be accepted as a uuid.
check('G  recovered display id rejected as uuid', isUuid('recovered-03-09-123-mtuhwjss'), false);
check('G  embedded display id rejected as uuid', isUuid('embedded:local-job'), false);
check('G  job name rejected as uuid', isUuid('New Job 03/09'), false);
check('G  minted uuid is valid', isUuid(newProjectUuid()), true);

// Matching: the right existing row is found, and a name-only collision is not auto-linked.
const rows = [
  { id: 'cccccccc-dddd-4eee-8fff-000000000000', project_name: 'Another Job', job_number: '01-01/001' },
  { id: 'dddddddd-eeee-4fff-8000-111111111111', project_name: 'New Job 03/09', job_number: '03-09/123', site_address: '2 ASTREET, SOMPLACE, QLD, 4557' },
];
const found = findExistingProjectRow(recoveredJob, rows);
check('M  existing row matched by job number', found?.row?.id, 'dddddddd-eeee-4fff-8000-111111111111');
check('M  match reported as exact', found?.confidence, 'exact');
const planLink = projectIdentityPlan(recoveredJob, { workspaceId: WORKSPACE, existingProjects: rows });
check('M  plan links rather than creating', planLink.action, 'link');
check('M  link needs no new database row', planLink.writeRequired, false);

const nameOnly = [{ id: 'eeeeeeee-ffff-4000-8111-222222222222', project_name: 'New Job 03/09' }];
const weak = projectIdentityPlan(recoveredJob, { workspaceId: WORKSPACE, existingProjects: nameOnly });
check('M  name-only collision is NOT auto-linked', weak.action, 'create');
check('M  weak match is still reported', weak.weakMatch?.confidence, 'weak');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
