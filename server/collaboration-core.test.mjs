import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CollaborationCore, CollaborationError } from './collaboration-core.mjs';

function workspaceState(name = '门店') {
  return {
    schemaVersion: 2,
    updatedAt: '2026-08-17T00:00:00.000Z',
    view: { center: [36, 120], zoom: 10, baseLayer: 'osm' },
    features: [
      {
        type: 'Feature',
        id: 'S1',
        geometry: { type: 'Point', coordinates: [120, 36] },
        properties: { locationId: 'S1', name }
      }
    ]
  };
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'geomap-private-'));
  let now = new Date('2026-08-17T00:00:00.000Z');
  const core = new CollaborationCore({
    filePath: join(directory, 'state.json'),
    clock: () => now
  });
  await core.initialize();
  const session = await core.setup({
    organizationName: '海岚经营公司',
    displayName: '管理员',
    email: 'owner@example.com',
    password: 'owner-password-123'
  });
  const owner = core.authenticate(session.token);
  const workspace = core.listWorkspaces(owner)[0];
  return {
    core,
    directory,
    owner,
    workspace,
    advance(days) {
      now = new Date(now.getTime() + days * 86_400_000);
    }
  };
}

test('private setup hashes passwords and optimistic locking prevents silent overwrites', async () => {
  const { core, directory, owner, workspace } = await fixture();
  const saved = await core.updateWorkspace(owner, workspace.workspaceId, 1, workspaceState());
  assert.equal(saved.version, 2);
  await assert.rejects(
    core.updateWorkspace(owner, workspace.workspaceId, 1, workspaceState('过期覆盖')),
    (error) =>
      error instanceof CollaborationError &&
      error.code === 'version-conflict' &&
      error.details.currentVersion === 2
  );
  const disk = await readFile(join(directory, 'state.json'), 'utf8');
  assert.doesNotMatch(disk, /owner-password-123/);
  assert.match(disk, /scrypt:/);
});

test('roles, mentions, resolution, read-only shares and audit remain scoped to one organization', async () => {
  const { core, owner, workspace } = await fixture();
  await core.updateWorkspace(owner, workspace.workspaceId, 1, workspaceState());
  const viewer = await core.addMember(owner, {
    email: 'viewer@example.com',
    displayName: '区域查看者',
    password: 'viewer-password-123',
    role: 'viewer'
  });
  const viewerSession = await core.login({
    email: viewer.email,
    password: 'viewer-password-123'
  });
  const viewerUser = core.authenticate(viewerSession.token);
  await assert.rejects(
    core.updateWorkspace(viewerUser, workspace.workspaceId, 2, workspaceState('越权修改')),
    (error) => error instanceof CollaborationError && error.code === 'forbidden'
  );
  const comment = await core.addComment(viewerUser, workspace.workspaceId, {
    entityRef: 'S1',
    body: '请 @owner@example.com 复核租金口径'
  });
  assert.equal(comment.mentionUserIds.length, 1);
  const resolved = await core.resolveComment(owner, workspace.workspaceId, comment.commentId, true);
  assert.equal(resolved.status, 'resolved');

  const share = await core.createShare(owner, workspace.workspaceId, {
    name: '管理层周报',
    expiresAt: '2026-08-20T00:00:00.000Z'
  });
  const publicValue = core.readShare(share.token);
  assert.equal(publicValue.name, '管理层周报');
  assert.equal(publicValue.workspaceVersion, 2);
  assert.equal(publicValue.snapshot.features[0].properties.name, '门店');
  assert.ok(core.listAudit(owner, workspace.workspaceId).length >= 4);
});

test('expired sessions and shares are rejected', async () => {
  const fixtureValue = await fixture();
  const { core, owner, workspace } = fixtureValue;
  const session = await core.login({
    email: 'owner@example.com',
    password: 'owner-password-123'
  });
  await core.updateWorkspace(owner, workspace.workspaceId, 1, workspaceState());
  const share = await core.createShare(owner, workspace.workspaceId, {
    expiresAt: '2026-08-18T00:00:00.000Z'
  });
  fixtureValue.advance(2);
  assert.throws(
    () => core.authenticate(session.token),
    (error) => error instanceof CollaborationError && error.code === 'session-expired'
  );
  assert.throws(
    () => core.readShare(share.token),
    (error) => error instanceof CollaborationError && error.code === 'share-not-found'
  );
});

test('operating action items track owners, due dates and status', async () => {
  const { core, owner, workspace } = await fixture();
  const editor = await core.addMember(owner, {
    email: 'editor@example.com',
    displayName: '运营经理',
    password: 'editor-password-123',
    role: 'editor'
  });
  const viewer = await core.addMember(owner, {
    email: 'action-viewer@example.com',
    displayName: '观察员',
    password: 'viewer-password-456',
    role: 'viewer'
  });
  const authenticate = async (member, password) =>
    core.authenticate((await core.login({ email: member.email, password })).token);
  const editorUser = await authenticate(editor, 'editor-password-123');
  const viewerUser = await authenticate(viewer, 'viewer-password-456');

  await assert.rejects(
    core.createActionItem(viewerUser, workspace.workspaceId, {
      title: '越权事项'
    }),
    (error) => error instanceof CollaborationError && error.code === 'forbidden'
  );
  await assert.rejects(
    core.createActionItem(editorUser, workspace.workspaceId, {
      title: '未知责任人',
      ownerEmail: 'missing@example.com'
    }),
    (error) => error instanceof CollaborationError && error.code === 'action-owner-not-found'
  );
  await assert.rejects(
    core.createActionItem(editorUser, workspace.workspaceId, {
      title: '无效日期',
      dueAt: '2026-02-31'
    }),
    (error) => error instanceof CollaborationError && error.code === 'invalid-action-due-date'
  );
  const actionItem = await core.createActionItem(editorUser, workspace.workspaceId, {
    entityRef: 'S1',
    title: '补充甲店晚间客流调研',
    description: '连续三个工作日完成 18:00–21:00 客流抽样。',
    priority: 'high',
    ownerEmail: 'owner@example.com',
    dueAt: '2026-08-20'
  });
  assert.equal(actionItem.status, 'todo');
  assert.equal(actionItem.ownerDisplayName, '管理员');
  assert.equal(actionItem.priority, 'high');
  assert.equal(core.listActionItems(viewerUser, workspace.workspaceId).length, 1);
  await assert.rejects(
    core.updateActionItem(viewerUser, workspace.workspaceId, actionItem.actionItemId, {
      status: 'doing'
    }),
    (error) => error instanceof CollaborationError && error.code === 'forbidden'
  );
  const doing = await core.updateActionItem(
    editorUser,
    workspace.workspaceId,
    actionItem.actionItemId,
    { status: 'doing' }
  );
  assert.equal(doing.status, 'doing');
  const completed = await core.updateActionItem(
    owner,
    workspace.workspaceId,
    actionItem.actionItemId,
    { status: 'done' }
  );
  assert.equal(completed.status, 'done');
  assert.ok(completed.completedAt);
  assert.ok(
    core
      .listAudit(owner, workspace.workspaceId)
      .some((entry) => entry.action === 'action-item.status.update')
  );
});
