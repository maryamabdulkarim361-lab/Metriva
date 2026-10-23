import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MLDashboardView } from "../components/ml/MLDashboardView";
import { api } from "../services/api";
import { MLForecastResult, MLChurnResult, MLInsights } from "../types";

vi.mock("../services/api", () => ({
  api: {
    getMLInsights: vi.fn(),
    getRevenueForecast: vi.fn(),
    getCustomerChurn: vi.fn(),
    getAnomalyScan: vi.fn(),
    getAnomalyAlerts: vi.fn(),
    getMLModels: vi.fn(),
    getMLJobs: vi.fn(),
    triggerMLJob: vi.fn(),
  },
}));

const mockInsights: MLInsights = {
  success: true,
  executive_summary: {
    observed_historical_facts: ["Q1 Revenue totaled $960,000 across 1,300 completed transactions."],
    predictive_estimates: ["Q2 Revenue projected at $1,050,000 (+9.3% QoQ)."],
    statistical_associations: ["Customer order frequency correlates with enterprise tier (r=0.78)."],
    investigation_hypotheses: ["SMB cohort cancellation rates elevated in southern geography."],
  },
  raw_model_telemetry: {
    forecast_mape: 4.2,
    churn_auc: 0.88,
  },
};

const mockForecast: MLForecastResult = {
  success: true,
  model_name: "Holt-Winters Triple Exponential Smoothing",
  model_version: "1.0.0",
  aggregation: "monthly",
  historical_periods_used: 12,
  historical_data: [
    { date: "2026-01-01", revenue: 250000, orders: 120 },
    { date: "2026-02-01", revenue: 300000, orders: 150 },
  ],
  forecast_horizon: 3,
  forecast_data: [
    { date: "2026-03-01", forecast: 350000, prediction_interval_lower: 320000, prediction_interval_upper: 380000, horizon_step: 1 },
    { date: "2026-04-01", forecast: 390000, prediction_interval_lower: 350000, prediction_interval_upper: 430000, horizon_step: 2 },
    { date: "2026-05-01", forecast: 420000, prediction_interval_lower: 370000, prediction_interval_upper: 470000, horizon_step: 3 },
  ],
  evaluation_metrics: {
    mae: 12500,
    rmse: 15800,
    mape_pct: 4.2,
    test_split_periods: 2,
  },
  baseline_comparison: {
    baseline_type: "Historical Moving Average",
    baseline_mae: 18500,
    baseline_rmse: 22000,
    baseline_mape_pct: 6.8,
    outperforms_baseline: true,
  },
  model_parameters: {},
};

const mockChurn: MLChurnResult = {
  success: true,
  model_name: "Calibrated Logistic Churn Classifier",
  model_version: "1.0.0",
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
  feature_importance: {
    recency_days: 0.45,
    order_frequency: 0.30,
    total_spend: 0.25,
  },
  top_at_risk_customers: [
    {
      customer_id: 42,
      customer_name: "Global Acme Logistics",
      customer_email: "acme@example.com",
      customer_segment: "Enterprise",
      recency_days: 94,
      order_frequency: 12,
      total_spend: 45000,
      churn_probability: 0.84,
      risk_score: 84.0,
      risk_level: "HIGH",
      primary_drivers: { recency_days: 94 },
    },
  ],
  risk_distribution: {
    high_risk_count: 12,
    medium_risk_count: 28,
    low_risk_count: 210,
  },
};

describe("MLDashboardView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders executive AI insights with epistemic taxonomy", async () => {
    vi.mocked(api.getMLInsights).mockResolvedValueOnce(mockInsights);
    vi.mocked(api.getRevenueForecast).mockResolvedValueOnce(mockForecast);

    render(<MLDashboardView />);

    await waitFor(() => {
      expect(screen.getByText(/Q1 Revenue totaled \$960,000/i)).toBeInTheDocument();
      expect(screen.getByText(/Q2 Revenue projected at \$1,050,000/i)).toBeInTheDocument();
    });
  });

  it("renders Revenue Forecasting metrics and horizon table", async () => {
    vi.mocked(api.getMLInsights).mockResolvedValueOnce(mockInsights);
    vi.mocked(api.getRevenueForecast).mockResolvedValueOnce(mockForecast);

    render(<MLDashboardView />);

    await waitFor(() => {
      expect(screen.getByText("Revenue Trajectory & 95% Confidence Bounds")).toBeInTheDocument();
      expect(screen.getByText("Holt-Winters Triple Exponential Smoothing")).toBeInTheDocument();
      expect(screen.getByText(/Projected Revenue Schedule/i)).toBeInTheDocument();
    });
  });

  it("switches to Customer Churn tab and renders at-risk accounts", async () => {
    vi.mocked(api.getMLInsights).mockResolvedValueOnce(mockInsights);
    vi.mocked(api.getRevenueForecast).mockResolvedValueOnce(mockForecast);
    vi.mocked(api.getCustomerChurn).mockResolvedValueOnce(mockChurn);

    render(<MLDashboardView />);

    await waitFor(() => {
      expect(screen.getByText("Revenue Trajectory & 95% Confidence Bounds")).toBeInTheDocument();
    });

    const churnTab = screen.getByRole("button", { name: /customer churn/i });
    fireEvent.click(churnTab);

    await waitFor(() => {
      expect(screen.getByText("Top At-Risk Customer Cohort")).toBeInTheDocument();
      expect(screen.getByText("Global Acme Logistics")).toBeInTheDocument();
      expect(screen.getByText("84.0%")).toBeInTheDocument();
      expect(screen.getByText(/94 days/i)).toBeInTheDocument();
    });
  });
});
