import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../App";
import { api } from "../services/api";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<any>("../services/api");
  return {
    ...actual,
    getAuthToken: vi.fn(() => null),
    setAuthToken: vi.fn(),
    api: {
      ...actual.api,
      getAIStatus: vi.fn().mockResolvedValue({
        provider: "mock",
        model: "deterministic",
        demo_mode: true,
        is_healthy: true,
        limits: {
          max_rows: 1000,
          max_query_seconds: 10,
          max_sql_length: 10000,
        },
      }),
      getDashboardData: vi.fn().mockResolvedValue({
        kpis: {
          total_revenue: 1875000,
          total_orders: 2500,
          total_customers: 250,
          avg_order_value: 750,
          completed_orders: 2200,
        },
        revenue_by_month: [],
        revenue_by_country: [],
        order_status_distribution: [],
        customer_segmentation: [],
        top_products: [],
        top_customers: [],
      }),
      getDataSources: vi.fn().mockResolvedValue([]),
      getSavedReports: vi.fn().mockResolvedValue([]),
      getScheduledReports: vi.fn().mockResolvedValue([]),
      getRevenueForecast: vi.fn().mockResolvedValue({
        success: true,
        model_name: "Holt-Winters",
        model_version: "1.0",
        historical_periods_used: 12,
        forecast_horizon: 3,
        historical_data: [],
        forecast_data: [],
        evaluation_metrics: { mae: 1000, rmse: 1200, mape_pct: 4.2, test_split_periods: 2 },
        baseline_comparison: {
          baseline_type: "Moving Average",
          baseline_mae: 1500,
          baseline_rmse: 1800,
          baseline_mape_pct: 5.5,
          outperforms_baseline: true,
        },
        model_parameters: {},
      }),
      getCustomerChurn: vi.fn().mockResolvedValue({
        success: true,
        model_name: "Logistic Classifier",
        model_version: "1.0",
        inactivity_definition_days: 90,
        total_cohort_customers: 250,
        churn_rate_pct: 14.0,
        evaluation_metrics: {
          accuracy: 0.89,
          precision: 0.82,
          recall: 0.78,
          f1_score: 0.80,
          test_split_size: 50,
          confusion_matrix: { tp: 10, fp: 2, tn: 35, fn: 3 },
        },
        baseline_comparison: {
          baseline_type: "Zero Rule Classifier",
          baseline_accuracy: 0.86,
          model_accuracy: 0.89,
        },
        top_at_risk_customers: [],
        risk_distribution: { high_risk_count: 5, medium_risk_count: 10, low_risk_count: 235 },
      }),
      getAnomalyScan: vi.fn().mockResolvedValue({ success: true, anomalies: [] }),
      getAnomalyAlerts: vi.fn().mockResolvedValue([]),
      getMLInsights: vi.fn().mockResolvedValue({
        success: true,
        executive_summary: {
          observed_historical_facts: ["Fact 1"],
          predictive_estimates: ["Estimate 1"],
          statistical_associations: ["Assoc 1"],
          investigation_hypotheses: ["Hypothesis 1"],
        },
        raw_model_telemetry: {},
      }),
      getMLModels: vi.fn().mockResolvedValue([]),
      getMLJobs: vi.fn().mockResolvedValue([]),
      getQueryHistory: vi.fn().mockResolvedValue([]),
      getMetricsDefinitions: vi.fn().mockResolvedValue([]),
      getComparisonData: vi.fn().mockResolvedValue({ data: [], summary: { observed_facts: [] } }),
      getSchemaMetadata: vi.fn().mockResolvedValue({ tables: [], relationships: [] }),
    },
  };
});

describe("Frontend Browser Integration Smoke Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders main application and navigates seamlessly across all core feature tabs", async () => {
    render(<App />);

    // 1. Initial Dashboard tab loads
    await waitFor(() => {
      expect(screen.getByText("AI Database Assistant")).toBeInTheDocument();
      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    });

    // 2. Click "Query SQL" CTA in header -> Switches to QueryView
    const queryHeaderBtn = screen.getByRole("button", { name: /query sql/i });
    fireEvent.click(queryHeaderBtn);

    await waitFor(() => {
      expect(screen.getByText("Natural Language Query Interface")).toBeInTheDocument();
    });

    // 3. Navigate to Reports view
    const reportsNav = screen.getByRole("button", { name: /reports & schedules/i });
    fireEvent.click(reportsNav);

    await waitFor(() => {
      expect(screen.getByText("Saved Reports & Automated Schedules")).toBeInTheDocument();
    });

    // 4. Navigate to Predictive ML view
    const mlNav = screen.getByRole("button", { name: /predictive analytics \(ml\)/i });
    fireEvent.click(mlNav);

    await waitFor(() => {
      expect(screen.getByText("Predictive Analytics & Machine Learning Engine")).toBeInTheDocument();
    });

    // 5. Navigate to Database Connections view
    const connectionsNav = screen.getByRole("button", { name: "Database Connections" });
    fireEvent.click(connectionsNav);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /database connections/i })).toBeInTheDocument();
    });

    // 6. Navigate to System Settings view
    const settingsNav = screen.getByRole("button", { name: /settings & engine/i });
    fireEvent.click(settingsNav);

    await waitFor(() => {
      expect(screen.getByText("System & Engine Settings")).toBeInTheDocument();
    });
  });
});
