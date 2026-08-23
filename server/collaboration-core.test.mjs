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

test('decision approvals bind a saved version and enforce separation of duties', async () => {
  const { core, owner, workspace } = await fixture();
  await core.updateWorkspace(owner, workspace.workspaceId, 1, workspaceState());
  const editor = await core.addMember(owner, {
    email: 'editor@example.com',
    displayName: '选址经理',
    password: 'editor-password-123',
    role: 'editor'
  });
  const admin = await core.addMember(owner, {
    email: 'admin@example.com',
    displayName: '决策委员',
    password: 'admin-password-123',
    role: 'admin'
  });
  const viewer = await core.addMember(owner, {
    email: 'approval-viewer@example.com',
    displayName: '观察员',
    password: 'viewer-password-456',
    role: 'viewer'
  });
  const authenticate = async (member, password) =>
    core.authenticate((await core.login({ email: member.email, password })).token);
  const editorUser = await authenticate(editor, 'editor-password-123');
  const adminUser = await authenticate(admin, 'admin-password-123');
  const viewerUser = await authenticate(viewer, 'viewer-password-456');

  await assert.rejects(
    core.createApproval(viewerUser, workspace.workspaceId, {
      title: '越权申请',
      summary: '不应创建'
    }),
    (error) => error instanceof CollaborationError && error.code === 'forbidden'
  );
  const approval = await core.createApproval(editorUser, workspace.workspaceId, {
    entityRef: 'S1',
    title: '甲店签约决策',
    summary: '建议按当前选址结果进入合同谈判。'
  });
  assert.equal(approval.workspaceVersion, 2);
  assert.equal(approval.status, 'pending');
  assert.equal(core.listApprovals(viewerUser, workspace.workspaceId).length, 1);
  await assert.rejects(
    core.updateApproval(editorUser, workspace.workspaceId, approval.approvalId, {
      decision: 'approved',
      comment: ''
    }),
    (error) => error instanceof CollaborationError && error.code === 'forbidden'
  );
  await assert.rejects(
    core.updateApproval(adminUser, workspace.workspaceId, approval.approvalId, {
      decision: 'rejected',
      comment: ''
    }),
    (error) => error instanceof CollaborationError && error.code === 'review-comment-required'
  );
  const reviewed = await core.updateApproval(
    adminUser,
    workspace.workspaceId,
    approval.approvalId,
    { decision: 'approved', comment: '同意，租金上限按简报执行。' }
  );
  assert.equal(reviewed.status, 'approved');
  assert.equal(reviewed.reviewerId, admin.userId);
  await assert.rejects(
    core.updateApproval(owner, workspace.workspaceId, approval.approvalId, {
      decision: 'rejected',
      comment: '重复审批'
    }),
    (error) => error instanceof CollaborationError && error.code === 'approval-finalized'
  );
  assert.ok(
    core
      .listAudit(owner, workspace.workspaceId)
      .some((entry) => entry.action === 'approval.approved')
  );
});
