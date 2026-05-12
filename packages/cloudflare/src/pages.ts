import type { CloudflareClient } from './client';

/**
 * Cloudflare Pages API.
 * Reference: https://developers.cloudflare.com/api/operations/pages-project-get-projects
 *
 * Each customer site gets its own Pages project. We push generated code to
 * the customer's GitHub repo (or our internal mono-template repo + branch),
 * and Pages auto-deploys via the Git integration.
 */

export interface PagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  source?: {
    type: 'github' | 'gitlab';
    config: {
      owner: string;
      repo_name: string;
      production_branch: string;
      pr_comments_enabled: boolean;
      deployments_enabled: boolean;
    };
  };
  build_config: {
    build_command?: string;
    destination_dir?: string;
    root_dir?: string;
    web_analytics_tag?: string;
    web_analytics_token?: string;
  };
  deployment_configs: {
    production: PagesDeploymentConfig;
    preview: PagesDeploymentConfig;
  };
  latest_deployment?: PagesDeployment;
  canonical_deployment?: PagesDeployment;
  created_on: string;
  production_branch: string;
}

export interface PagesDeploymentConfig {
  env_vars?: Record<string, { value: string; type?: 'plain_text' | 'secret_text' }>;
  compatibility_date?: string;
  compatibility_flags?: string[];
  d1_databases?: Record<string, { id: string }>;
  kv_namespaces?: Record<string, { namespace_id: string }>;
  r2_buckets?: Record<string, { name: string }>;
}

export interface PagesDeployment {
  id: string;
  short_id: string;
  project_id: string;
  project_name: string;
  environment: 'production' | 'preview';
  url: string;
  created_on: string;
  modified_on: string;
  latest_stage: {
    name: 'queued' | 'initialize' | 'clone_repo' | 'build' | 'deploy';
    started_on: string;
    ended_on: string | null;
    status: 'idle' | 'active' | 'canceled' | 'success' | 'failure' | 'skipped';
  };
  deployment_trigger: {
    type: 'ad_hoc' | 'github:push' | 'gitlab:push';
    metadata: {
      branch: string;
      commit_hash: string;
      commit_message: string;
    };
  };
  stages: Array<{
    name: string;
    status: string;
    started_on: string;
    ended_on: string | null;
  }>;
  aliases?: string[];
}

export interface PagesDomain {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'deactivated';
  verification_data?: { status: string };
  validation_data?: { status: string; method: string };
  zone_id?: string;
  zone_tag?: string;
  certificate_authority?: 'google' | 'lets_encrypt';
  created_on: string;
}

export class PagesClient {
  constructor(private readonly client: CloudflareClient) {}

  private base(): string {
    return `/accounts/${this.client.account.id}/pages/projects`;
  }

  // ─── Projects ──────────────────────────────────────────────────────────────

  async listProjects(params: { page?: number; per_page?: number } = {}): Promise<PagesProject[]> {
    return this.client.get<PagesProject[]>(this.base(), { query: params });
  }

  async getProject(name: string): Promise<PagesProject> {
    return this.client.get<PagesProject>(`${this.base()}/${encodeURIComponent(name)}`);
  }

  /**
   * Create a Pages project. For HostDaddy.ai we generally use direct uploads
   * (no Git source) so customers can iterate without needing a GitHub account.
   */
  async createProject(input: {
    name: string;
    production_branch?: string;
    source?: PagesProject['source'];
    build_config?: PagesProject['build_config'];
    deployment_configs?: PagesProject['deployment_configs'];
  }): Promise<PagesProject> {
    return this.client.post<PagesProject>(this.base(), {
      name: input.name,
      production_branch: input.production_branch ?? 'main',
      source: input.source,
      build_config: input.build_config ?? {},
      deployment_configs: input.deployment_configs ?? {
        production: {},
        preview: {},
      },
    });
  }

  async deleteProject(name: string): Promise<{ id: string }> {
    return this.client.delete<{ id: string }>(`${this.base()}/${encodeURIComponent(name)}`);
  }

  // ─── Deployments ───────────────────────────────────────────────────────────

  /** Trigger a fresh deployment (used after pushing new code). */
  async createDeployment(projectName: string, branch?: string): Promise<PagesDeployment> {
    return this.client.post<PagesDeployment>(
      `${this.base()}/${encodeURIComponent(projectName)}/deployments`,
      branch ? { branch } : undefined,
    );
  }

  async getDeployment(projectName: string, deploymentId: string): Promise<PagesDeployment> {
    return this.client.get<PagesDeployment>(
      `${this.base()}/${encodeURIComponent(projectName)}/deployments/${deploymentId}`,
    );
  }

  async listDeployments(projectName: string): Promise<PagesDeployment[]> {
    return this.client.get<PagesDeployment[]>(
      `${this.base()}/${encodeURIComponent(projectName)}/deployments`,
    );
  }

  /** Roll back to a previous successful deployment. */
  async rollbackDeployment(projectName: string, deploymentId: string): Promise<PagesDeployment> {
    return this.client.post<PagesDeployment>(
      `${this.base()}/${encodeURIComponent(projectName)}/deployments/${deploymentId}/rollback`,
    );
  }

  // ─── Custom Domains ────────────────────────────────────────────────────────

  async listDomains(projectName: string): Promise<PagesDomain[]> {
    return this.client.get<PagesDomain[]>(
      `${this.base()}/${encodeURIComponent(projectName)}/domains`,
    );
  }

  async addDomain(projectName: string, domain: string): Promise<PagesDomain> {
    return this.client.post<PagesDomain>(
      `${this.base()}/${encodeURIComponent(projectName)}/domains`,
      { name: domain },
    );
  }

  async removeDomain(projectName: string, domain: string): Promise<{ id: string }> {
    return this.client.delete<{ id: string }>(
      `${this.base()}/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(domain)}`,
    );
  }
}
