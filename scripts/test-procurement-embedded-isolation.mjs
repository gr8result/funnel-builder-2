import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';

const pagePath = new URL('../pages/modules/builders/procurement-schedule.js', import.meta.url);
const source = fs.readFileSync(pagePath, 'utf8');
const start = source.indexOf('export default function BuilderProcurementSchedulePage(');
const end = source.indexOf('  const selectedProject =', start);
assert(start >= 0 && end > start, 'Procurement selection effects must be available for isolation testing');
const component = source.slice(start, end).replace('export default ', '');
const makeRender = new Function('useState', 'useEffect', 'useWorkspace', 'supabase', 'useRef', `${component}
  return { selectedProjectId, selectedSnapshotId, error, procurementItems };
}
return BuilderProcurementSchedulePage;`);

function fixture() {
  const projects = [
    { id: 'project-unrelated', workspace_id: 'builder-a', source_workbook_job_id: 'job-unrelated', project_name: 'Unrelated project' },
    { id: 'project-a', workspace_id: 'builder-a', source_workbook_job_id: 'job-a', project_name: 'Linked project' },
    { id: 'project-b', workspace_id: 'builder-b', source_workbook_job_id: 'job-b', project_name: 'Other builder' },
  ];
  const snapshots = [
    { id: 'snapshot-newer', workspace_id: 'builder-a', project_id: 'project-a', source_workbook_job_id: 'job-a' },
    { id: 'snapshot-a', workspace_id: 'builder-a', project_id: 'project-a', source_workbook_job_id: 'job-a' },
    { id: 'snapshot-unrelated', workspace_id: 'builder-a', project_id: 'project-unrelated', source_workbook_job_id: 'job-unrelated' },
    { id: 'snapshot-b', workspace_id: 'builder-b', project_id: 'project-b', source_workbook_job_id: 'job-b' },
  ];
  return { builder_commercial_projects: projects, builder_estimate_snapshots: snapshots };
}

function linkedProps(overrides = {}) {
  return {
    embedded: true,
    workspaceId: 'builder-a',
    organisationId: 'builder-a',
    projectId: 'job-a',
    commercialProjectId: 'project-a',
    snapshotId: 'snapshot-a',
    estimateSnapshotId: 'snapshot-a',
    workbook: { jobId: 'job-a', workspaceId: 'builder-a', commercialProjectId: 'project-a' },
    ...overrides,
  };
}

function harness(props, rows = fixture()) {
  const states = [];
  const effects = [];
  const reads = [];
  let cursor = 0;
  let dirty = true;
  let currentProps = props;
  let workspaceId = 'builder-a';
  let result;
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], (value) => {
      const next = typeof value === 'function' ? value(states[index]) : value;
      if (!Object.is(next, states[index])) {
        states[index] = next;
        dirty = true;
      }
    }];
  };
  const useEffect = (run, dependencies) => {
    const index = cursor++;
    const previous = effects[index];
    if (previous && dependencies.length === previous.dependencies.length
      && dependencies.every((value, position) => Object.is(value, previous.dependencies[position]))) return;
    previous?.cleanup?.();
    effects[index] = { dependencies, run, pending: true };
  };
  const supabase = {
    from(table) {
      const filters = [];
      const query = {
        select() { return query; },
        eq(column, value) { filters.push([column, value]); return query; },
        order() { return query; },
        update() { throw new Error('Isolation regression must never write database data'); },
        then(resolve, reject) {
          reads.push({ table, filters: [...filters] });
          const data = (rows[table] || []).filter((row) => filters.every(([column, value]) => row[column] === value));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const useRef = (initial) => useState({ current: initial })[0];
  const render = makeRender(useState, useEffect, () => ({ workspaceId, loading: false }), supabase, useRef);
  return {
    reads,
    async settle(nextProps = currentProps, nextWorkspaceId = workspaceId) {
      currentProps = nextProps;
      workspaceId = nextWorkspaceId;
      dirty = true;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (dirty) {
          dirty = false;
          cursor = 0;
          result = render(currentProps);
          for (const effect of effects) {
            if (!effect?.pending) continue;
            effect.pending = false;
            effect.cleanup = effect.run();
          }
        }
        await setImmediate();
        if (!dirty) return result;
      }
      throw new Error('Procurement selection effects did not settle');
    },
  };
}

function assertClosed(result) {
  assert.equal(result.selectedProjectId, '', 'No unrelated project may be selected');
  assert.equal(result.selectedSnapshotId, '', 'No unrelated snapshot may be selected');
  assert.equal(result.procurementItems.length, 0);
  assert.match(result.error, /job|project|snapshot|workspace|builder|tenant|link|association/i, 'A missing association needs an actionable error');
}

test('embedded job selects its exact project and snapshot rather than first results', async () => {
  const run = harness(linkedProps());
  const result = await run.settle();
  assert.equal(result.selectedProjectId, 'project-a');
  assert.equal(result.selectedSnapshotId, 'snapshot-a');
  assert(!run.reads.some(({ filters }) => filters.some(([column, value]) => column === 'project_id' && value === 'project-unrelated')));
});

test('valid existing associations survive repeated renders', async () => {
  const rows = fixture();
  rows.builder_commercial_projects.reverse();
  rows.builder_estimate_snapshots.reverse();
  const run = harness(linkedProps(), rows);
  const first = await run.settle();
  const second = await run.settle();
  assert.deepEqual([first.selectedProjectId, first.selectedSnapshotId], ['project-a', 'snapshot-a']);
  assert.deepEqual(second, first);
});

test('missing commercial project link fails closed', async () => {
  const run = harness(linkedProps({ commercialProjectId: '', workbook: { jobId: 'job-a', workspaceId: 'builder-a' } }));
  assertClosed(await run.settle());
});

test('missing exact snapshot link never selects the newest snapshot', async () => {
  const run = harness(linkedProps({ snapshotId: '', estimateSnapshotId: '' }));
  const result = await run.settle();
  assert.equal(result.selectedSnapshotId, '');
  assert.match(result.error, /snapshot|link|sync/i);
});

test('reload recovers only a unique current snapshot bound to the same job', async () => {
  const rows = fixture();
  rows.builder_estimate_snapshots.find((snapshot) => snapshot.id === 'snapshot-a').status = 'current';
  const run = harness(linkedProps({ snapshotId: '', estimateSnapshotId: '' }), rows);
  const result = await run.settle();
  assert.equal(result.selectedProjectId, 'project-a');
  assert.equal(result.selectedSnapshotId, 'snapshot-a');
});

test('ambiguous current snapshots cannot be silently recovered on reload', async () => {
  const rows = fixture();
  for (const snapshot of rows.builder_estimate_snapshots) snapshot.status = 'current';
  const run = harness(linkedProps({ snapshotId: '', estimateSnapshotId: '' }), rows);
  const result = await run.settle();
  assert.equal(result.selectedSnapshotId, '');
  assert.match(result.error, /unique|snapshot/i);
});

test('project and snapshot IDs are insufficient when their source job differs', async () => {
  const rows = fixture();
  rows.builder_commercial_projects.find((project) => project.id === 'project-a').source_workbook_job_id = 'job-unrelated';
  assertClosed(await harness(linkedProps(), rows).settle());
  const snapshotRows = fixture();
  snapshotRows.builder_estimate_snapshots.find((snapshot) => snapshot.id === 'snapshot-a').source_workbook_job_id = 'job-unrelated';
  const result = await harness(linkedProps(), snapshotRows).settle();
  assert.equal(result.selectedSnapshotId, '');
  assert.match(result.error, /snapshot/i);
});

test('commercial project belonging to another builder is rejected', async () => {
  const run = harness(linkedProps({ commercialProjectId: 'project-b' }));
  assertClosed(await run.settle());
});

test('snapshot belonging to another project is rejected', async () => {
  const run = harness(linkedProps({ snapshotId: 'snapshot-unrelated', estimateSnapshotId: 'snapshot-unrelated' }));
  const result = await run.settle();
  assert.equal(result.selectedSnapshotId, '');
  assert.match(result.error, /snapshot|project|link|association/i);
});

test('workbook tenant must match the active workspace', async () => {
  const run = harness(linkedProps({ workbook: { jobId: 'job-a', workspaceId: 'builder-b', commercialProjectId: 'project-a' } }));
  assertClosed(await run.settle());
});

test('missing workbook job identity fails closed', async () => {
  const run = harness(linkedProps({ projectId: '', workbook: { workspaceId: 'builder-a', commercialProjectId: 'project-a' } }));
  assertClosed(await run.settle());
});

test('embedded job identity must agree with the loaded workbook', async () => {
  const run = harness(linkedProps({ projectId: 'job-other' }));
  assertClosed(await run.settle());
});

test('conflicting workbook and embedded commercial project links are rejected', async () => {
  const run = harness(linkedProps({ workbook: { jobId: 'job-a', workspaceId: 'builder-a', commercialProjectId: 'project-unrelated' } }));
  assertClosed(await run.settle());
});

test('switching builders cannot silently adopt a different project', async () => {
  const run = harness(linkedProps());
  await run.settle();
  assertClosed(await run.settle(linkedProps(), 'builder-b'));
});

test('procurement updates must include exact project and snapshot predicates', () => {
  const update = source.slice(source.indexOf('  async function saveItem('), source.indexOf('\n  return (', source.indexOf('  async function saveItem(')));
  assert.match(update, /\.eq\("project_id",/);
  assert.match(update, /\.eq\("snapshot_id",/);
});