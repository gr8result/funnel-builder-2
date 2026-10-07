import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { findMasterJobForProject, mergeMasterJobSummaries } from '../lib/construction-estimation/masterJob.js';

const local = { key: 'job:master-a', jobId: 'master-a', name: 'Michael and Sarah Johnson' };
const other = { key: 'job:master-b', jobId: 'master-b', name: local.name };
const project = { id: 'commercial-a', source_workbook_job_id: 'master-a', project_name: local.name };
assert.equal(findMasterJobForProject(project, [other, local]), local);
assert.equal(findMasterJobForProject({ id: 'commercial-z', project_name: local.name }, [local]), null, 'Names cannot link a commercial record');
assert.deepEqual(mergeMasterJobSummaries([local], [{ key: 'project:commercial-a', jobId: 'master-a' }]), [local], 'Matching permanent IDs deduplicate even without a cached local key');

const file = ts.createSourceFile('sync.js', fs.readFileSync('pages/api/builders/sync-commercial-snapshot.js', 'utf8'), ts.ScriptTarget.Latest, true);
const functions = ['projectSourceFields', 'firstText', 'textOrNull', 'plainObject', 'workbookDataValue', 'workbookFileProjectName'];
const bodies = file.statements.filter(n => ts.isFunctionDeclaration(n) && functions.includes(n.name?.text)).map(n => n.getText(file)).join('\n');
const projectSourceFields = new Function(`${bodies}; return projectSourceFields;`)();
assert.equal(projectSourceFields({ sourceWorkbookJobId: 'stale-id' }, { jobId: 'master-a', id: 'commercial-a', jobFileMeta: { jobNumber: 'MSJ-001' } }).source_workbook_job_id, 'master-a', 'The permanent ID wins over an external commercial id');
assert.equal(projectSourceFields({}, { jobFileMeta: { jobNumber: 'MSJ-001' }, openedFileName: 'Michael and Sarah Johnson.gr8job' }).source_workbook_job_id, '', 'A filename or job number cannot become a database identity');
console.log('PASS cloud summaries and commercial snapshots link by permanent jobId; equal names and job numbers never identify a job');
