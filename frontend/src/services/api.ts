import {
  AIStatus,
  ApiResponse,
  CachedSchema,
  ColumnMaskingPolicy,
  CurrentUser,
  DashboardData,
  DataSource,
  MetricDefinition,
  MLAnomalyAlert,
  MLAnomalyScanResult,
  MLChurnResult,
  MLForecastResult,
  MLInsights,
  MLJob,
  MLModel,
  Organization,
  OrganizationMembership,
  PeriodComparisonResult,
  QueryExecutionResult,
  QueryHistoryItem,
  SavedReport,
  ScheduledReport,
  SchemaMetadata,
  TestConnectionRequest,
  TestConnectionResponse,
  UserRole,
} from "../types";

const BASE_URL = "/api";
const TOKEN_KEY = "aidb_access_token";
const ACTIVE_ORG_KEY = "aidb_active_org_id";

export const getAuthToken = (): string | null => {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string | null): void => {
  try {
    if (typeof localStorage !== "undefined") {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  } catch {
    // Ignore storage errors
  }
};

export const getActiveOrgId = (): number | null => {
  try {
    if (typeof localStorage !== "undefined") {
      const val = localStorage.getItem(ACTIVE_ORG_KEY);
      return val ? parseInt(val, 10) : null;
    }
    return null;
  } catch {
    return null;
  }
};

export const setActiveOrgId = (id: number | null): void => {
  try {
    if (typeof localStorage !== "undefined") {
      if (id !== null) {
        localStorage.setItem(ACTIVE_ORG_KEY, String(id));
      } else {
        localStorage.removeItem(ACTIVE_ORG_KEY);
      }
    }
  } catch {
    // Ignore storage errors
  }
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const activeOrgId = getActiveOrgId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeOrgId ? { "X-Organization-ID": String(activeOrgId) } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const responseText = await response.text();
  let json: ApiResponse<T> | null = null;

  if (responseText.trim()) {
    try {
      json = JSON.parse(responseText) as ApiResponse<T>;
    } catch {
      json = null;
    }
  }

  // Handle non-2xx HTTP responses
  if (!response.ok) {
    const status = response.status;
    const statusText = response.statusText || "Error";
    const serverMessage = json?.error?.message || json?.message;
    const fallbackText =
      responseText.length < 150 && responseText.trim() && !responseText.includes("<html")
        ? responseText.trim()
        : `Request failed with HTTP status ${status} (${statusText})`;

    const errorMsg = serverMessage || fallbackText;
    const err = new Error(errorMsg);
    (err as any).status = status;
    (err as any).code = json?.error?.code || `HTTP_${status}`;
    (err as any).details = json?.error?.details;
    throw err;
  }

  // Handle non-JSON successful responses
  if (!json) {
    const err = new Error(
      `Empty or invalid JSON response received from ${endpoint} (HTTP status ${response.status})`
    );
    (err as any).status = response.status;
    (err as any).code = "INVALID_RESPONSE";
    throw err;
  }

  // Handle API logical failure flags
  if (!json.success) {
    const errorMsg = json.error?.message || json.message || "An unexpected error occurred.";
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).code = json.error?.code || "API_ERROR";
    (err as any).details = json.error?.details;
    throw err;
  }

  return json.data;
}

export const api = {
  // Authentication & Session
  login: async (credentials: { email: string; password: string }): Promise<{ tokens: { access: string; refresh: string }; user: any }> => {
    const res = await request<{ tokens: { access: string; refresh: string }; user: any }>("/auth/login/", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    if (res?.tokens?.access) {
      setAuthToken(res.tokens.access);
    }
    return res;
  },

  register: (data: { email: string; name: string; password: string }): Promise<any> =>
    request<any>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCurrentUser: (): Promise<any> => request<any>("/auth/me/"),

  logout: (): void => {
    setAuthToken(null);
  },

  // Dashboard & Metrics
  getDashboardData: (): Promise<DashboardData> => request<DashboardData>("/dashboard/"),
  getRevenueAnalytics: (): Promise<any[]> => request<any[]>("/analytics/revenue/"),
  getCustomerSegments: (): Promise<any[]> => request<any[]>("/analytics/customers/"),
  getProductPerformance: (): Promise<any[]> => request<any[]>("/analytics/products/"),

  // AI Natural Language Query
  askQuestion: (
    question: string,
    dryRun: boolean = false,
    dataSourceId?: number | null
  ): Promise<QueryExecutionResult> =>
    request<QueryExecutionResult>("/query/", {
      method: "POST",
      body: JSON.stringify({
        question,
        dry_run: dryRun,
        data_source_id: dataSourceId || null,
      }),
    }),

  executeDirectSQL: (
    sql: string,
    question?: string,
    dataSourceId?: number | null
  ): Promise<QueryExecutionResult> =>
    request<QueryExecutionResult>("/query/execute-direct/", {
      method: "POST",
      body: JSON.stringify({
        sql,
        question,
        data_source_id: dataSourceId || null,
      }),
    }),

  getAIStatus: (): Promise<AIStatus> => request<AIStatus>("/query/status/"),

  // Data Sources & External Connections
  getDataSources: (): Promise<DataSource[]> => request<DataSource[]>("/datasources/"),

  getDataSource: (id: number): Promise<DataSource> => request<DataSource>(`/datasources/${id}/`),

  createDataSource: (data: Partial<DataSource> & { password?: string }): Promise<DataSource> =>
    request<DataSource>("/datasources/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDataSource: (
    id: number,
    data: Partial<DataSource> & { password?: string }
  ): Promise<DataSource> =>
    request<DataSource>(`/datasources/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteDataSource: (id: number): Promise<void> =>
    request<void>(`/datasources/${id}/`, {
      method: "DELETE",
    }),

  testRawConnection: (data: TestConnectionRequest): Promise<TestConnectionResponse> =>
    request<TestConnectionResponse>("/datasources/test-raw/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  testSavedDataSource: (id: number): Promise<TestConnectionResponse> =>
    request<TestConnectionResponse>(`/datasources/${id}/test/`, {
      method: "POST",
    }),

  refreshDataSourceSchema: (id: number): Promise<CachedSchema> =>
    request<CachedSchema>(`/datasources/${id}/refresh-schema/`, {
      method: "POST",
    }),

  updateAllowedTables: (id: number, allowedTables: string[]): Promise<DataSource> =>
    request<DataSource>(`/datasources/${id}/allowed-tables/`, {
      method: "POST",
      body: JSON.stringify({ allowed_tables: allowedTables }),
    }),

  // Query History
  getQueryHistory: (statusFilter?: string): Promise<{ results?: QueryHistoryItem[] } | QueryHistoryItem[]> => {
    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    return request<any>(`/query/history/${query}`);
  },

  rerunQuery: (historyId: number): Promise<any> =>
    request<any>(`/query/history/${historyId}/rerun/`, {
      method: "POST",
    }),

  // Schema Explorer
  getSchemaMetadata: (): Promise<SchemaMetadata> => request<SchemaMetadata>("/schema/"),

  // Business Metrics Layer
  getMetrics: (metricId?: string): Promise<MetricDefinition[] | MetricDefinition> => {
    const q = metricId ? `?metric_id=${encodeURIComponent(metricId)}` : "";
    return request<any>(`/analytics/metrics/${q}`);
  },

  // Period Comparisons
  getPeriodComparison: (params?: {
    period?: string;
    dimension?: string;
    limit?: number;
  }): Promise<PeriodComparisonResult> => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set("period", params.period);
    if (params?.dimension) searchParams.set("dimension", params.dimension);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<PeriodComparisonResult>(`/analytics/compare-periods/${qs ? `?${qs}` : ""}`);
  },

  // Saved Reports
  getSavedReports: (category?: string): Promise<SavedReport[]> => {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    return request<SavedReport[]>(`/reports/${q}`);
  },

  createSavedReport: (data: Partial<SavedReport>): Promise<SavedReport> =>
    request<SavedReport>("/reports/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createReport: (data: Partial<SavedReport>): Promise<SavedReport> =>
    request<SavedReport>("/reports/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSavedReport: (id: number, data: Partial<SavedReport>): Promise<SavedReport> =>
    request<SavedReport>(`/reports/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteSavedReport: (id: number): Promise<void> =>
    request<void>(`/reports/${id}/`, {
      method: "DELETE",
    }),

  refreshSavedReport: (id: number): Promise<any> =>
    request<any>(`/reports/${id}/refresh/`, {
      method: "POST",
    }),

  duplicateSavedReport: (id: number): Promise<SavedReport> =>
    request<SavedReport>(`/reports/${id}/duplicate/`, {
      method: "POST",
    }),

  // Scheduled Reports
  getScheduledReports: (): Promise<ScheduledReport[]> =>
    request<ScheduledReport[]>("/scheduled-reports/"),

  createScheduledReport: (data: Partial<ScheduledReport>): Promise<ScheduledReport> =>
    request<ScheduledReport>("/scheduled-reports/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  toggleScheduleActive: (id: number): Promise<{ id: number; is_active: boolean }> =>
    request<{ id: number; is_active: boolean }>(`/scheduled-reports/${id}/toggle-active/`, {
      method: "POST",
    }),

  toggleSchedule: (id: number): Promise<{ id: number; is_active: boolean }> =>
    request<{ id: number; is_active: boolean }>(`/scheduled-reports/${id}/toggle-active/`, {
      method: "POST",
    }),

  triggerScheduleNow: (id: number): Promise<any> =>
    request<any>(`/scheduled-reports/${id}/trigger-now/`, {
      method: "POST",
    }),

  deleteScheduledReport: (id: number): Promise<void> =>
    request<void>(`/scheduled-reports/${id}/`, {
      method: "DELETE",
    }),

  // Machine Learning & Predictive Analytics
  getRevenueForecast: (params?: {
    aggregation?: string;
    horizon?: number;
  }): Promise<MLForecastResult> => {
    const searchParams = new URLSearchParams();
    if (params?.aggregation) searchParams.set("aggregation", params.aggregation);
    if (params?.horizon) searchParams.set("horizon", String(params.horizon));
    const qs = searchParams.toString();
    return request<MLForecastResult>(`/ml/forecast/revenue/${qs ? `?${qs}` : ""}`);
  },

  getCustomerChurn: (inactivityDays?: number): Promise<MLChurnResult> => {
    const q = inactivityDays ? `?inactivity_days=${inactivityDays}` : "";
    return request<MLChurnResult>(`/ml/churn/customers/${q}`);
  },

  getAnomalyScan: (zThreshold?: number): Promise<MLAnomalyScanResult> => {
    const q = zThreshold ? `?z_threshold=${zThreshold}` : "";
    return request<MLAnomalyScanResult>(`/ml/anomalies/scan/${q}`);
  },

  getAnomalyAlerts: (unacknowledged?: boolean): Promise<MLAnomalyAlert[]> => {
    const q = unacknowledged ? "?unacknowledged=true" : "";
    return request<MLAnomalyAlert[]>(`/ml/anomalies/${q}`);
  },

  acknowledgeAnomalyAlert: (id: number): Promise<any> =>
    request<any>(`/ml/anomalies/${id}/acknowledge/`, {
      method: "POST",
    }),

  getMLInsights: (topic?: string): Promise<MLInsights> => {
    const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
    return request<MLInsights>(`/ml/insights/${q}`);
  },

  getMLModels: (): Promise<MLModel[]> => request<MLModel[]>("/ml/models/"),

  approveModelVersion: (modelId: number, versionId: number): Promise<any> =>
    request<any>(`/ml/models/${modelId}/approve-version/`, {
      method: "POST",
      body: JSON.stringify({ version_id: versionId }),
    }),

  getMLJobs: (): Promise<MLJob[]> => request<MLJob[]>("/ml/jobs/"),

  triggerMLJob: (jobType: string, parameters?: any): Promise<{ job_id: number; status: string }> =>
    request<{ job_id: number; status: string }>("/ml/jobs/trigger/", {
      method: "POST",
      body: JSON.stringify({ job_type: jobType, parameters: parameters || {} }),
    }),

  // Organizations & RBAC Team Management
  getOrganizations: (): Promise<Organization[]> => request<Organization[]>("/organizations/"),

  createOrganization: (name: string): Promise<Organization> =>
    request<Organization>("/organizations/", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  getOrganizationMembers: (orgId: number): Promise<OrganizationMembership[]> =>
    request<OrganizationMembership[]>(`/organizations/${orgId}/members/`),

  addOrganizationMember: (
    orgId: number,
    email: string,
    role: UserRole
  ): Promise<OrganizationMembership> =>
    request<OrganizationMembership>(`/organizations/${orgId}/members/`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),

  updateMemberRole: (
    orgId: number,
    userId: number,
    role: UserRole
  ): Promise<OrganizationMembership> =>
    request<OrganizationMembership>(`/organizations/${orgId}/members/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  removeOrganizationMember: (orgId: number, userId: number): Promise<any> =>
    request<any>(`/organizations/${orgId}/members/${userId}/`, {
      method: "DELETE",
    }),

  getMaskingPolicies: (orgId: number): Promise<ColumnMaskingPolicy[]> =>
    request<ColumnMaskingPolicy[]>(`/organizations/${orgId}/masking-policies/`),

  createMaskingPolicy: (
    orgId: number,
    policy: {
      rule_name: string;
      match_type: "EXACT" | "REGEX";
      match_pattern: string;
      masking_type: "REDACT" | "EMAIL" | "PHONE" | "NULLIFY";
      is_active?: boolean;
    }
  ): Promise<ColumnMaskingPolicy> =>
    request<ColumnMaskingPolicy>(`/organizations/${orgId}/masking-policies/`, {
      method: "POST",
      body: JSON.stringify(policy),
    }),

  deleteMaskingPolicy: (orgId: number, policyId: number): Promise<any> =>
    request<any>(`/organizations/${orgId}/masking-policies/${policyId}/`, {
      method: "DELETE",
    }),
};

