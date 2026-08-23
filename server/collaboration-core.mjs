import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const ROLE_LEVEL = { viewer: 1, editor: 2, admin: 3, owner: 4 };

function emptyState() {
  return {
    schemaVersion: 1,
    organizations: [],
    users: [],
    workspaces: [],
    comments: [],
    actionItems: [],
    shares: [],
    briefs: [],
    syncJobs: [],
    audit: []
  };
}

function clone(value) {
  return structuredClone(value);
}

async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new CollaborationError(400, 'weak-password', '密码至少需要 12 个字符。');
  }
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(derived).toString('hex')}`;
}

async function passwordMatches(password, encoded) {
  const [algorithm, salt, expected] = String(encoded).split(':');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = Buffer.from(await scrypt(password, salt, 64));
  const expectedBytes = Buffer.from(expected, 'hex');
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes);
}

export class CollaborationError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class CollaborationCore {
  #filePath;
  #clock;
  #state = emptyState();
  #sessions = new Map();
  #writeQueue = Promise.resolve();

  constructor({ filePath, clock = () => new Date(), sessionHours = 12 }) {
    if (!filePath) throw new Error('Private data file path is required.');
    this.#filePath = filePath;
    this.#clock = clock;
    this.sessionHours = sessionHours;
  }

  async initialize() {
    try {
      const parsed = JSON.parse(await readFile(this.#filePath, 'utf8'));
      if (parsed.schemaVersion !== 1) throw new Error('Unsupported private data schema.');
      this.#state = { ...emptyState(), ...parsed };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await this.#persist();
    }
    return this.status();
  }

  status() {
    return {
      configured: this.#state.organizations.length > 0,
      schemaVersion: this.#state.schemaVersion
    };
  }

  async setup({
    organizationName,
    displayName,
    email,
    password,
    workspaceName = '经营决策工作区'
  }) {
    if (this.status().configured) {
      throw new CollaborationError(409, 'already-configured', '私有服务已经完成初始化。');
    }
    const normalizedEmail = this.#email(email);
    if (!String(organizationName ?? '').trim() || !String(displayName ?? '').trim()) {
      throw new CollaborationError(400, 'invalid-setup', '组织名称和管理员姓名不能为空。');
    }
    const now = this.#now();
    const organizationId = randomUUID();
    const userId = randomUUID();
    const workspaceId = randomUUID();
    this.#state.organizations.push({
      organizationId,
      name: String(organizationName).trim(),
      brand: { productName: 'Geomap', primaryColor: '#2563eb', logoUrl: null },
      createdAt: now
    });
    this.#state.users.push({
      userId,
      organizationId,
      displayName: String(displayName).trim(),
      email: normalizedEmail,
      passwordHash: await passwordHash(password),
      role: 'owner',
      active: true,
      createdAt: now
    });
    this.#state.workspaces.push({
      workspaceId,
      organizationId,
      name: String(workspaceName).trim() || '经营决策工作区',
      version: 1,
      state: null,
      updatedAt: now,
      updatedBy: userId
    });
    this.#audit(userId, organizationId, workspaceId, 'private-service.setup', {
      organizationName: String(organizationName).trim()
    });
    await this.#persist();
    return this.login({ email: normalizedEmail, password });
  }

  async login({ email, password }) {
    const normalizedEmail = this.#email(email);
    const user = this.#state.users.find((item) => item.email === normalizedEmail && item.active);
    if (!user || !(await passwordMatches(password, user.passwordHash))) {
      throw new CollaborationError(401, 'invalid-credentials', '邮箱或密码错误。');
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      this.#clock().getTime() + this.sessionHours * 3_600_000
    ).toISOString();
    this.#sessions.set(token, { userId: user.userId, expiresAt });
    this.#audit(user.userId, user.organizationId, null, 'session.login', {});
    await this.#persist();
    return { token, expiresAt, user: this.#publicUser(user) };
  }

  logout(token) {
    this.#sessions.delete(token);
  }

  authenticate(token) {
    const session = this.#sessions.get(token);
    if (!session || session.expiresAt <= this.#now()) {
      if (token) this.#sessions.delete(token);
      throw new CollaborationError(401, 'session-expired', '登录已失效，请重新登录。');
    }
    const user = this.#state.users.find((item) => item.userId === session.userId && item.active);
    if (!user) throw new CollaborationError(401, 'user-disabled', '用户不可用。');
    return clone(user);
  }

  me(user) {
    const organization = this.#state.organizations.find(
      (item) => item.organizationId === user.organizationId
    );
    return { user: this.#publicUser(user), organization: clone(organization) };
  }

  listWorkspaces(user) {
    return this.#state.workspaces
      .filter((workspace) => workspace.organizationId === user.organizationId)
      .map(({ state: _state, ...workspace }) => clone(workspace));
  }

  getWorkspace(user, workspaceId) {
    const workspace = this.#workspace(user, workspaceId, 'viewer');
    return clone(workspace);
  }

  async updateWorkspace(user, workspaceId, expectedVersion, state) {
    const workspace = this.#workspace(user, workspaceId, 'editor');
    if (!Number.isInteger(expectedVersion)) {
      throw new CollaborationError(428, 'version-required', '保存必须携带当前工作区版本。');
    }
    if (workspace.version !== expectedVersion) {
      throw new CollaborationError(409, 'version-conflict', '工作区已被其他成员更新。', {
        currentVersion: workspace.version,
        currentUpdatedAt: workspace.updatedAt,
        currentUpdatedBy: workspace.updatedBy
      });
    }
    if (!state || state.schemaVersion !== 2 || !Array.isArray(state.features)) {
      throw new CollaborationError(400, 'invalid-workspace', '只接受有效的 Workspace schema v2。');
    }
    workspace.state = clone(state);
    workspace.version += 1;
    workspace.updatedAt = this.#now();
    workspace.updatedBy = user.userId;
    this.#audit(user.userId, user.organizationId, workspaceId, 'workspace.update', {
      version: workspace.version
    });
    await this.#persist();
    return clone(workspace);
  }

  listMembers(user) {
    this.#requireRole(user, 'admin');
    return this.#state.users
      .filter((item) => item.organizationId === user.organizationId)
      .map((item) => this.#publicUser(item));
  }

  async addMember(user, { email, displayName, password, role }) {
    this.#requireRole(user, 'admin');
    if (!['viewer', 'editor', 'admin'].includes(role)) {
      throw new CollaborationError(400, 'invalid-role', '成员角色无效。');
    }
    const normalizedEmail = this.#email(email);
    if (this.#state.users.some((item) => item.email === normalizedEmail)) {
      throw new CollaborationError(409, 'email-exists', '邮箱已经存在。');
    }
    const member = {
      userId: randomUUID(),
      organizationId: user.organizationId,
      displayName: String(displayName ?? '').trim(),
      email: normalizedEmail,
      passwordHash: await passwordHash(password),
      role,
      active: true,
      createdAt: this.#now()
    };
    if (!member.displayName) {
      throw new CollaborationError(400, 'invalid-member', '成员姓名不能为空。');
    }
    this.#state.users.push(member);
    this.#audit(user.userId, user.organizationId, null, 'member.add', {
      memberId: member.userId,
      role
    });
    await this.#persist();
    return this.#publicUser(member);
  }

  listComments(user, workspaceId, entityRef) {
    this.#workspace(user, workspaceId, 'viewer');
    return this.#state.comments
      .filter(
        (comment) =>
          comment.workspaceId === workspaceId && (!entityRef || comment.entityRef === entityRef)
      )
      .map((comment) => clone(comment));
  }

  async addComment(user, workspaceId, { entityRef, body }) {
    this.#workspace(user, workspaceId, 'viewer');
    const content = String(body ?? '').trim();
    if (!content || content.length > 4000) {
      throw new CollaborationError(400, 'invalid-comment', '评论需要 1–4000 个字符。');
    }
    const mentionedEmails = [...content.matchAll(/@([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g)].map(
      (match) => match[1].toLowerCase()
    );
    const mentionUserIds = this.#state.users
      .filter(
        (item) =>
          item.organizationId === user.organizationId && mentionedEmails.includes(item.email)
      )
      .map((item) => item.userId);
    const comment = {
      commentId: randomUUID(),
      workspaceId,
      entityRef: String(entityRef ?? '').trim() || null,
      body: content,
      authorId: user.userId,
      mentionUserIds,
      status: 'open',
      createdAt: this.#now(),
      resolvedAt: null,
      resolvedBy: null
    };
    this.#state.comments.push(comment);
    this.#audit(user.userId, user.organizationId, workspaceId, 'comment.add', {
      commentId: comment.commentId,
      entityRef: comment.entityRef,
      mentionUserIds
    });
    await this.#persist();
    return clone(comment);
  }

  async resolveComment(user, workspaceId, commentId, resolved) {
    this.#workspace(user, workspaceId, 'editor');
    const comment = this.#state.comments.find(
      (item) => item.commentId === commentId && item.workspaceId === workspaceId
    );
    if (!comment) throw new CollaborationError(404, 'comment-not-found', '评论不存在。');
    comment.status = resolved ? 'resolved' : 'open';
    comment.resolvedAt = resolved ? this.#now() : null;
    comment.resolvedBy = resolved ? user.userId : null;
    this.#audit(user.userId, user.organizationId, workspaceId, 'comment.resolve', {
      commentId,
      resolved: Boolean(resolved)
    });
    await this.#persist();
    return clone(comment);
  }

  listActionItems(user, workspaceId) {
    this.#workspace(user, workspaceId, 'viewer');
    return this.#state.actionItems
      .filter((item) => item.workspaceId === workspaceId)
      .slice()
      .reverse()
      .map((item) => this.#publicActionItem(item));
  }

  async createActionItem(
    user,
    workspaceId,
    { entityRef, title, description, priority, ownerEmail, dueAt }
  ) {
    this.#workspace(user, workspaceId, 'editor');
    const normalizedTitle = String(title ?? '').trim();
    const normalizedDescription = String(description ?? '').trim();
    const normalizedEntityRef = String(entityRef ?? '').trim();
    if (!normalizedTitle || normalizedTitle.length > 120) {
      throw new CollaborationError(400, 'invalid-action-title', '事项标题需要 1–120 个字符。');
    }
    if (normalizedDescription.length > 4000) {
      throw new CollaborationError(
        400,
        'invalid-action-description',
        '事项说明不能超过 4000 个字符。'
      );
    }
    if (normalizedEntityRef.length > 200) {
      throw new CollaborationError(400, 'invalid-entity-ref', '关联对象 ID 不能超过 200 个字符。');
    }
    const normalizedPriority = String(priority ?? 'medium');
    if (!['low', 'medium', 'high', 'critical'].includes(normalizedPriority)) {
      throw new CollaborationError(400, 'invalid-action-priority', '事项优先级无效。');
    }
    const normalizedDueAt = String(dueAt ?? '').trim();
    const dueDate = normalizedDueAt ? new Date(`${normalizedDueAt}T00:00:00Z`) : null;
    if (
      normalizedDueAt &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDueAt) ||
        Number.isNaN(dueDate.getTime()) ||
        dueDate.toISOString().slice(0, 10) !== normalizedDueAt)
    ) {
      throw new CollaborationError(400, 'invalid-action-due-date', '事项截止日期无效。');
    }
    const owner = ownerEmail
      ? this.#state.users.find(
          (item) =>
            item.organizationId === user.organizationId &&
            item.active &&
            item.email === this.#email(ownerEmail)
        )
      : user;
    if (ownerEmail && !owner) {
      throw new CollaborationError(404, 'action-owner-not-found', '责任人不是当前组织的有效成员。');
    }
    const now = this.#now();
    const actionItem = {
      actionItemId: randomUUID(),
      workspaceId,
      entityRef: normalizedEntityRef || null,
      title: normalizedTitle,
      description: normalizedDescription,
      priority: normalizedPriority,
      status: 'todo',
      ownerId: owner?.userId ?? null,
      dueAt: normalizedDueAt || null,
      createdBy: user.userId,
      createdAt: now,
      updatedBy: user.userId,
      completedAt: null,
      updatedAt: now
    };
    this.#state.actionItems.push(actionItem);
    this.#audit(user.userId, user.organizationId, workspaceId, 'action-item.create', {
      actionItemId: actionItem.actionItemId,
      ownerId: actionItem.ownerId,
      priority: actionItem.priority,
      dueAt: actionItem.dueAt,
      entityRef: actionItem.entityRef
    });
    await this.#persist();
    return this.#publicActionItem(actionItem);
  }

  async updateActionItem(user, workspaceId, actionItemId, { status }) {
    this.#workspace(user, workspaceId, 'editor');
    const actionItem = this.#state.actionItems.find(
      (item) => item.actionItemId === actionItemId && item.workspaceId === workspaceId
    );
    if (!actionItem) {
      throw new CollaborationError(404, 'action-item-not-found', '经营事项不存在。');
    }
    const normalizedStatus = String(status ?? '');
    if (!['todo', 'doing', 'done'].includes(normalizedStatus)) {
      throw new CollaborationError(400, 'invalid-action-status', '事项状态无效。');
    }
    const now = this.#now();
    actionItem.status = normalizedStatus;
    actionItem.updatedBy = user.userId;
    actionItem.updatedAt = now;
    actionItem.completedAt = normalizedStatus === 'done' ? now : null;
    this.#audit(user.userId, user.organizationId, workspaceId, 'action-item.status.update', {
      actionItemId,
      status: normalizedStatus
    });
    await this.#persist();
    return this.#publicActionItem(actionItem);
  }

  async createShare(user, workspaceId, { name, expiresAt }) {
    const workspace = this.#workspace(user, workspaceId, 'editor');
    if (!workspace.state) {
      throw new CollaborationError(409, 'workspace-empty', '请先保存工作区，再创建只读分享。');
    }
    const expiry = expiresAt
      ? new Date(expiresAt)
      : new Date(this.#clock().getTime() + 7 * 86_400_000);
    if (Number.isNaN(expiry.getTime()) || expiry <= this.#clock()) {
      throw new CollaborationError(400, 'invalid-expiry', '只读链接过期时间无效。');
    }
    const share = {
      shareId: randomUUID(),
      token: randomBytes(24).toString('base64url'),
      workspaceId,
      organizationId: user.organizationId,
      name: String(name ?? '').trim() || `${workspace.name}只读简报`,
      workspaceVersion: workspace.version,
      snapshot: clone(workspace.state),
      createdBy: user.userId,
      createdAt: this.#now(),
      expiresAt: expiry.toISOString(),
      revokedAt: null
    };
    this.#state.shares.push(share);
    this.#audit(user.userId, user.organizationId, workspaceId, 'share.create', {
      shareId: share.shareId,
      workspaceVersion: share.workspaceVersion,
      expiresAt: share.expiresAt
    });
    await this.#persist();
    return { ...clone(share), snapshot: undefined };
  }

  readShare(token) {
    const share = this.#state.shares.find((item) => item.token === token && !item.revokedAt);
    if (!share || share.expiresAt <= this.#now()) {
      throw new CollaborationError(404, 'share-not-found', '只读链接不存在或已过期。');
    }
    const organization = this.#state.organizations.find(
      (item) => item.organizationId === share.organizationId
    );
    return {
      name: share.name,
      workspaceVersion: share.workspaceVersion,
      snapshot: clone(share.snapshot),
      brand: clone(organization?.brand),
      expiresAt: share.expiresAt
    };
  }

  async createBrief(user, workspaceId, { title, savedViewId, notes }) {
    const workspace = this.#workspace(user, workspaceId, 'viewer');
    const brief = {
      briefId: randomUUID(),
      workspaceId,
      workspaceVersion: workspace.version,
      title: String(title ?? '').trim() || '经营管理简报',
      savedViewId: savedViewId || null,
      notes: String(notes ?? '').trim(),
      createdBy: user.userId,
      createdAt: this.#now()
    };
    this.#state.briefs.push(brief);
    this.#audit(user.userId, user.organizationId, workspaceId, 'brief.create', {
      briefId: brief.briefId
    });
    await this.#persist();
    return clone(brief);
  }

  async saveBrand(user, brand) {
    this.#requireRole(user, 'admin');
    const organization = this.#state.organizations.find(
      (item) => item.organizationId === user.organizationId
    );
    organization.brand = {
      productName: String(brand.productName ?? '').trim() || 'Geomap',
      primaryColor: /^#[0-9A-Fa-f]{6}$/.test(brand.primaryColor) ? brand.primaryColor : '#2563eb',
      logoUrl: /^https:\/\//.test(brand.logoUrl ?? '') ? brand.logoUrl : null
    };
    this.#audit(user.userId, user.organizationId, null, 'organization.brand.update', {});
    await this.#persist();
    return clone(organization.brand);
  }

  async createSyncJob(user, workspaceId, { name, adapter, scheduleMinutes }) {
    this.#workspace(user, workspaceId, 'admin');
    if (!['webhook', 'file-drop'].includes(adapter)) {
      throw new CollaborationError(400, 'invalid-adapter', '同步适配器无效。');
    }
    const minutes = Number(scheduleMinutes);
    if (!Number.isInteger(minutes) || minutes < 5) {
      throw new CollaborationError(400, 'invalid-schedule', '同步间隔至少 5 分钟。');
    }
    const job = {
      syncJobId: randomUUID(),
      workspaceId,
      organizationId: user.organizationId,
      name: String(name ?? '').trim() || '经营数据同步',
      adapter,
      scheduleMinutes: minutes,
      enabled: true,
      secret: adapter === 'webhook' ? randomBytes(24).toString('base64url') : null,
      lastRunAt: null,
      lastStatus: 'never',
      createdAt: this.#now()
    };
    this.#state.syncJobs.push(job);
    this.#audit(user.userId, user.organizationId, workspaceId, 'sync-job.create', {
      syncJobId: job.syncJobId,
      adapter,
      scheduleMinutes: minutes
    });
    await this.#persist();
    return clone(job);
  }

  listSyncJobs(user, workspaceId) {
    this.#workspace(user, workspaceId, 'admin');
    return this.#state.syncJobs
      .filter((job) => job.workspaceId === workspaceId)
      .map((job) => ({ ...clone(job), secret: job.secret ? 'configured' : null }));
  }

  listAudit(user, workspaceId) {
    this.#workspace(user, workspaceId, 'admin');
    return this.#state.audit
      .filter((entry) => entry.workspaceId === workspaceId || entry.workspaceId === null)
      .slice(-200)
      .reverse()
      .map((entry) => clone(entry));
  }

  #workspace(user, workspaceId, role) {
    this.#requireRole(user, role);
    const workspace = this.#state.workspaces.find(
      (item) => item.workspaceId === workspaceId && item.organizationId === user.organizationId
    );
    if (!workspace) throw new CollaborationError(404, 'workspace-not-found', '工作区不存在。');
    return workspace;
  }

  #requireRole(user, required) {
    if ((ROLE_LEVEL[user.role] ?? 0) < ROLE_LEVEL[required]) {
      throw new CollaborationError(403, 'forbidden', `此操作需要 ${required} 权限。`);
    }
  }

  #publicUser(user) {
    const { passwordHash: _passwordHash, ...safe } = user;
    return clone(safe);
  }

  #publicActionItem(actionItem) {
    const owner = this.#state.users.find((item) => item.userId === actionItem.ownerId);
    return clone({
      ...actionItem,
      ownerDisplayName: owner?.displayName ?? null,
      ownerEmail: owner?.email ?? null
    });
  }

  #email(value) {
    const email = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new CollaborationError(400, 'invalid-email', '邮箱格式无效。');
    }
    return email;
  }

  #now() {
    return this.#clock().toISOString();
  }

  #audit(userId, organizationId, workspaceId, action, details) {
    this.#state.audit.push({
      auditId: randomUUID(),
      userId,
      organizationId,
      workspaceId,
      action,
      details: clone(details),
      createdAt: this.#now()
    });
  }

  async #persist() {
    this.#writeQueue = this.#writeQueue.then(async () => {
      await mkdir(dirname(this.#filePath), { recursive: true });
      const temporary = `${this.#filePath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(this.#state, null, 2), { mode: 0o600 });
      await rename(temporary, this.#filePath);
    });
    await this.#writeQueue;
  }
}
