export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface DashboardKPIs {
  total_customers: number;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  completed_orders: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
}

export interface CountryRevenue {
  country: string;
  revenue: number;
  order_count: number;
}

export interface OrderStatusDistribution {
  status: string;
  count: number;
}

export interface CustomerSegmentDistribution {
  customer_segment: string;
  count: number;
}

export interface TopProduct {
  product_id: number;
  product__name: string;
  product__category: string;
  total_units_sold: number;
  total_revenue: number;
}

export interface TopCustomer {
  id: number;
  name: string;
  email: string;
  customer_segment: string;
  country: string;
  lifetime_revenue: number;
  order_count: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  revenue_by_month: MonthlyRevenue[];
  revenue_by_country: CountryRevenue[];
  order_status_distribution: OrderStatusDistribution[];
  customer_segmentation: CustomerSegmentDistribution[];
  top_products: TopProduct[];
  top_customers: TopCustomer[];
}

export interface QueryExecutionResult {
  question: string;
  sql: string;
  columns: string[];
  rows: any[][];
  row_count: number;
  execution_time_ms: number;
  explanation: string;
  tables_used?: string[];
  query_history_id?: number;
}

export interface QueryHistoryItem {
  id: number;
  user_email: string | null;
  natural_language_question: string;
  generated_sql: string;
  execution_status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'TIMEOUT';
  execution_time_ms: number;
  row_count: number;
  error_message: string | null;
  explanation: string | null;
  created_at: string;
}

export interface SchemaColumn {
  name: string;
  type: string;
  primary_key?: boolean;
  foreign_key?: string;
  choices?: string[];
  description?: string;
  nullable?: boolean;
}

export interface SchemaTable {
  name: string;
  description: string;
  row_count: number;
  columns: SchemaColumn[];
  foreign_keys: any[];
}

export interface SchemaRelationship {
  from: string;
  from_col: string;
  to: string;
  to_col: string;
  type: string;
}

export interface SchemaMetadata {
  tables: SchemaTable[];
  relationships: SchemaRelationship[];
  allowed_tables: string[];
}

export interface AIStatus {
  provider: 'openai' | 'mock_demo';
  model: string;
  api_key_configured: boolean;
  demo_mode: boolean;
  limits: {
    max_rows: number;
    max_query_seconds: number;
    max_sql_length: number;
  };
}

export type DataSourceEngine = 'postgresql' | 'mysql' | 'sqlite';
export type SSLMode = 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';

export interface ColumnMetadata {
  name: string;
  type: string;
  primary_key: boolean;
  nullable: boolean;
  is_sensitive: boolean;
}

export interface TableMetadata {
  schema: string;
  name: string;
  columns: ColumnMetadata[];
  primary_keys: string[];
  foreign_keys: {
    constrained_columns: string[];
    referred_table: string;
    referred_columns: string[];
  }[];
}

export interface CachedSchema {
  engine: DataSourceEngine;
  database_name: string;
  schemas: string[];
  tables: TableMetadata[];
  table_count: number;
  synced_at: string;
}

export interface DataSource {
  id: number;
  name: string;
  engine: DataSourceEngine;
  host: string;
  port: number;
  database_name: string;
  username: string;
  ssl_mode: SSLMode;
  is_active: boolean;
  allowed_schemas: string[];
  allowed_tables: string[];
  cached_schema: CachedSchema | null;
  schema_last_synced_at: string | null;
  user: number | null;
  created_at: string;
  updated_at: string;
}

export interface TestConnectionRequest {
  engine: DataSourceEngine;
  host?: string;
  port?: number;
  database_name: string;
  username?: string;
  password?: string;
  ssl_mode?: SSLMode;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  latency_ms?: number;
  code?: string;
}

// ==========================================
// Phase 3: BI, Metrics, Reports, Comparisons
// ==========================================

export interface MetricDefinition {
  id: string;
  name: string;
  category: string;
  formula: string;
  unit: string;
  currency?: string | null;
  required_tables: string[];
  required_columns: string[];
  filter_criteria: string;
  assumptions: string;
  version: string;
}

export interface PeriodComparisonSummary {
  observed_facts: string[];
  statistical_associations: string[];
  investigation_hypotheses: string[];
}

export interface PeriodComparisonResult {
  period_type: string;
  period_label: string;
  dimension?: string | null;
  periods_analyzed: number;
  data: any[];
  summary: PeriodComparisonSummary;
}

export type ChartType = 'table' | 'kpi' | 'bar' | 'line' | 'pie' | 'scatter';

export interface ChartConfig {
  x_axis?: string;
  y_axis?: string | string[];
  title?: string;
  color?: string;
  show_labels?: boolean;
}

export interface SavedReport {
  id: number;
  name: string;
  description: string;
  category: string;
  natural_language_question: string;
  sql: string;
  chart_type: ChartType;
  chart_config: ChartConfig;
  data_source: number | null;
  data_source_name?: string | null;
  user?: number | null;
  user_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledReportExecution {
  id: number;
  scheduled_report: number;
  executed_at: string;
  status: 'SUCCESS' | 'FAILED';
  row_count: number;
  execution_time_ms: number;
  error_message?: string | null;
  summary_payload?: any;
}

export interface ScheduledReport {
  id: number;
  report: number;
  report_name?: string;
  name: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  day_of_week?: number | null;
  day_of_month?: number | null;
  time_of_day: string;
  timezone: string;
  is_active: boolean;
  delivery_channel: 'IN_APP' | 'WEBHOOK';
  delivery_target?: string;
  last_run_at?: string | null;
  next_run_at?: string | null;
  executions?: ScheduledReportExecution[];
  created_at: string;
  updated_at: string;
}

// ==========================================
// Phase 4: Machine Learning & Predictive
// ==========================================

export interface MLForecastPoint {
  date: string;
  forecast: number;
  prediction_interval_lower: number;
  prediction_interval_upper: number;
  horizon_step: number;
}

export interface MLForecastResult {
  success: boolean;
  model_name: string;
  model_version: string;
  aggregation: string;
  historical_periods_used: number;
  historical_data: { date: string; revenue: number; orders: number }[];
  forecast_horizon: number;
  forecast_data: MLForecastPoint[];
  evaluation_metrics: {
    mae: number;
    rmse: number;
    mape_pct?: number | null;
    test_split_periods: number;
  };
  baseline_comparison: {
    baseline_type: string;
    baseline_mae: number;
    baseline_rmse: number;
    baseline_mape_pct?: number | null;
    outperforms_baseline: boolean;
  };
  model_parameters: any;
  error?: string;
}

export interface MLChurnCustomer {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_segment: string;
  recency_days: number;
  order_frequency: number;
  total_spend: number;
  churn_probability: number;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  primary_drivers: Record<string, number>;
  actual_churn?: number;
}

export interface MLChurnResult {
  success: boolean;
  model_name: string;
  model_version: string;
  inactivity_definition_days: number;
  total_cohort_customers: number;
  churn_rate_pct: number;
  evaluation_metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    test_split_size: number;
    confusion_matrix: { tp: number; fp: number; tn: number; fn: number };
  };
  baseline_comparison: {
    baseline_type: string;
    baseline_accuracy: number;
    model_accuracy: number;
  };
  feature_importance: Record<string, number>;
  top_at_risk_customers: MLChurnCustomer[];
  risk_distribution: {
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
  };
  error?: string;
}

export interface MLAnomalyItem {
  metric_name: string;
  date: string;
  observed_value: number;
  baseline_mean: number;
  z_score: number;
  deviation_pct: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context_summary: string;
}

export interface MLAnomalyScanResult {
  success: boolean;
  scanned_days: number;
  total_anomalies_detected: number;
  z_threshold: number;
  metric_baselines: Record<string, { mean: number; std: number; anomalies_count: number }>;
  anomalies: MLAnomalyItem[];
  error?: string;
}

export interface MLAnomalyAlert {
  id: number;
  metric_name: string;
  alert_timestamp: string;
  observed_value: number;
  baseline_value: number;
  deviation_score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context_summary: string;
  is_acknowledged: boolean;
  acknowledged_at?: string | null;
  created_at: string;
}

export interface MLInsights {
  success: boolean;
  executive_summary: {
    observed_historical_facts: string[];
    predictive_estimates: string[];
    statistical_associations: string[];
    investigation_hypotheses: string[];
  };
  raw_model_telemetry: any;
}

export interface MLModelVersion {
  id: number;
  version: string;
  dataset_identifier: string;
  training_start_date?: string | null;
  training_end_date?: string | null;
  feature_names: string[];
  hyperparameters: any;
  evaluation_metrics: any;
  baseline_metrics: any;
  approval_status: 'DRAFT' | 'EVALUATED' | 'APPROVED' | 'REJECTED';
  is_active: boolean;
  created_at: string;
}

export interface MLModel {
  id: number;
  name: string;
  model_type: string;
  description: string;
  created_at: string;
  versions: MLModelVersion[];
  active_version?: MLModelVersion | null;
}

export interface MLJob {
  id: number;
  job_type: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  progress_pct: number;
  parameters: any;
  result_summary: any;
  error_message?: string | null;
  logs: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export type UserRole = 'ADMIN' | 'ANALYST' | 'VIEWER';

export interface OrganizationMembership {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  role: UserRole;
  member_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ColumnMaskingPolicy {
  id: number;
  rule_name: string;
  match_type: 'EXACT' | 'REGEX';
  match_pattern: string;
  masking_type: 'REDACT' | 'EMAIL' | 'PHONE' | 'NULLIFY';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CurrentUser {
  id?: number;
  name?: string;
  email: string;
  is_staff?: boolean;
  active_organization?: {
    id: number;
    name: string;
    slug: string;
    role: UserRole;
  } | null;
  organizations?: {
    id: number;
    name: string;
    slug: string;
    role: UserRole;
  }[];
}
