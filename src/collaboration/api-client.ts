import type {
  CollaborationOrganization,
  CollaborationUser,
  OrganizationBrand,
  RemoteWorkspace,
  RemoteWorkspaceSummary,
  WorkspaceComment,
  WorkspaceState
} from '../types';

export class CollaborationApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    value: { error?: string; message?: string; details?: Record<string, unknown> }
  ) {
    super(value.message ?? `Private API request failed (${status}).`);
    this.status = status;
    this.code = value.error ?? 'request-failed';
    this.details = value.details;
  }
}

export interface CollaborationSession {
  token: string;
  expiresAt: string;
  user: CollaborationUser;
}

export interface SyncJob {
  syncJobId: string;
  workspaceId: string;
  name: string;
  adapter: 'webhook' | 'file-drop';
  scheduleMinutes: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string;
}

export interface AuditEntry {
  auditId: string;
  userId: string;
  workspaceId: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export class CollaborationApiClient {
  readonly baseUrl: string;
  #token: string | null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.#token = window.sessionStorage.getItem(this.#storageKey());
  }

  get authenticated(): boolean {
    return Boolean(this.#token);
  }

  async health(): Promise<{ ok: boolean; configured: boolean; schemaVersion: number }> {
    return this.#request('/api/health', { anonymous: true });
  }

  async setup(value: {
    organizationName: string;
    displayName: string;
    email: string;
    password: string;
  }): Promise<CollaborationSession> {
    return this.#saveSession(
      await this.#request('/api/setup', { method: 'POST', body: value, anonymous: true })
    );
  }

  async login(email: string, password: string): Promise<CollaborationSession> {
    return this.#saveSession(
      await this.#request('/api/sessions', {
        method: 'POST',
        body: { email, password },
        anonymous: true
      })
    );
  }

  async logout(): Promise<void> {
    if (this.#token) await this.#request('/api/sessions/current', { method: 'DELETE' });
    this.#token = null;
    window.sessionStorage.removeItem(this.#storageKey());
  }

  me(): Promise<{ user: CollaborationUser; organization: CollaborationOrganization }> {
    return this.#request('/api/me');
  }

  async listWorkspaces(): Promise<RemoteWorkspaceSummary[]> {
    const value = await this.#request<{ workspaces: RemoteWorkspaceSummary[] }>('/api/workspaces');
    return value.workspaces;
  }

  getWorkspace(workspaceId: string): Promise<RemoteWorkspace> {
    return this.#request(`/api/workspaces/${encodeURIComponent(workspaceId)}`);
  }

  saveWorkspace(
    workspaceId: string,
    version: number,
    state: WorkspaceState
  ): Promise<RemoteWorkspace> {
    return this.#request(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: 'PUT',
      headers: { 'if-match': `"${version}"` },
      body: { state }
    });
  }

  async listComments(workspaceId: string): Promise<WorkspaceComment[]> {
    const value = await this.#request<{ comments: WorkspaceComment[] }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/comments`
    );
    return value.comments;
  }

  addComment(workspaceId: string, entityRef: string, body: string): Promise<WorkspaceComment> {
    return this.#request(`/api/workspaces/${encodeURIComponent(workspaceId)}/comments`, {
      method: 'POST',
      body: { entityRef, body }
    });
  }

  resolveComment(
    workspaceId: string,
    commentId: string,
    resolved: boolean
  ): Promise<WorkspaceComment> {
    return this.#request(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'PATCH', body: { resolved } }
    );
  }

  async listMembers(): Promise<CollaborationUser[]> {
    const value = await this.#request<{ members: CollaborationUser[] }>('/api/members');
    return value.members;
  }

  addMember(value: {
    email: string;
    displayName: string;
    password: string;
    role: 'viewer' | 'editor' | 'admin';
  }): Promise<CollaborationUser> {
    return this.#request('/api/members', { method: 'POST', body: value });
  }

  createShare(
    workspaceId: string,
    name: string
  ): Promise<{
    shareId: string;
    token: string;
    name: string;
    expiresAt: string;
    workspaceVersion: number;
  }> {
    return this.#request(`/api/workspaces/${encodeURIComponent(workspaceId)}/shares`, {
      method: 'POST',
      body: { name }
    });
  }

  readShare(token: string): Promise<{
    name: string;
    workspaceVersion: number;
    snapshot: WorkspaceState;
    brand: OrganizationBrand;
    expiresAt: string;
  }> {
    return this.#request(`/api/shares/${encodeURIComponent(token)}`, { anonymous: true });
  }

  createBrief(workspaceId: string, title: string, notes: string): Promise<{ briefId: string }> {
    return this.#request(`/api/workspaces/${encodeURIComponent(workspaceId)}/briefs`, {
      method: 'POST',
      body: { title, notes }
    });
  }

  async listSyncJobs(workspaceId: string): Promise<SyncJob[]> {
    const value = await this.#request<{ syncJobs: SyncJob[] }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/sync-jobs`
    );
    return value.syncJobs;
  }

  createSyncJob(
    workspaceId: string,
    value: { name: string; adapter: 'webhook' | 'file-drop'; scheduleMinutes: number }
  ): Promise<SyncJob> {
    return this.#request(`/api/workspaces/${encodeURIComponent(workspaceId)}/sync-jobs`, {
      method: 'POST',
      body: value
    });
  }

  async listAudit(workspaceId: string): Promise<AuditEntry[]> {
    const value = await this.#request<{ audit: AuditEntry[] }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/audit`
    );
    return value.audit;
  }

  saveBrand(brand: OrganizationBrand): Promise<OrganizationBrand> {
    return this.#request('/api/organization/brand', { method: 'PUT', body: brand });
  }

  #saveSession(session: CollaborationSession): CollaborationSession {
    this.#token = session.token;
    window.sessionStorage.setItem(this.#storageKey(), session.token);
    return session;
  }

  #storageKey(): string {
    return `geomap.private.session.${this.baseUrl}`;
  }

  async #request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      anonymous?: boolean;
    } = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(!options.anonymous && this.#token ? { authorization: `Bearer ${this.#token}` } : {}),
        ...options.headers
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
    });
    const value = (await response.json().catch(() => ({}))) as T & {
      error?: string;
      message?: string;
      details?: Record<string, unknown>;
    };
    if (!response.ok) throw new CollaborationApiError(response.status, value);
    return value;
  }
}
