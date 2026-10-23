import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReportsView } from "../components/reports/ReportsView";
import { ChartRecommendationView } from "../components/query/ChartRecommendationView";
import { api } from "../services/api";
import { QueryExecutionResult, SavedReport } from "../types";

vi.mock("../services/api", () => ({
  api: {
    getSavedReports: vi.fn(),
    getScheduledReports: vi.fn(),
    refreshSavedReport: vi.fn(),
    createSavedReport: vi.fn(),
    deleteSavedReport: vi.fn(),
    duplicateSavedReport: vi.fn(),
  },
}));

const mockSavedReports: SavedReport[] = [
  {
    id: 1,
    name: "Monthly Revenue Breakdown",
    description: "Tracks month-over-month revenue figures",
    category: "Revenue",
    natural_language_question: "What was our monthly revenue in 2026?",
    sql: "SELECT strftime('%Y-%m', order_date) as sales_month, SUM(total_amount) as revenue FROM orders GROUP BY sales_month;",
    chart_type: "bar",
    chart_config: { x_axis: "sales_month", y_axis: "revenue" },
    data_source: null,
    created_at: "2026-10-20T10:00:00Z",
    updated_at: "2026-10-21T10:00:00Z",
  },
];

const mockQueryResult: QueryExecutionResult = {
  question: "Revenue by category",
  sql: "SELECT category, SUM(subtotal) as category_revenue FROM order_items GROUP BY category;",
  columns: ["category", "category_revenue"],
  rows: [
    ["Software", 500000],
    ["Hardware", 350000],
    ["Services", 120000],
  ],
  row_count: 3,
  execution_time_ms: 10.5,
  explanation: "Software dominates with $500,000 revenue.",
  tables_used: ["order_items"],
};

describe("Reports & Visualizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays list of saved business reports", async () => {
    vi.mocked(api.getSavedReports).mockResolvedValueOnce(mockSavedReports);
    vi.mocked(api.getScheduledReports).mockResolvedValueOnce([]);

    render(<ReportsView />);

    await waitFor(() => {
      expect(screen.getByText("Monthly Revenue Breakdown")).toBeInTheDocument();
      expect(screen.getAllByText("Revenue").length).toBeGreaterThan(0);
      expect(screen.getByText(/What was our monthly revenue in 2026/i)).toBeInTheDocument();
    });
  });

  it("filters saved reports by category", async () => {
    const multiCatReports: SavedReport[] = [
      ...mockSavedReports,
      {
        id: 2,
        name: "Customer Churn Risk Report",
        description: "Customer churn probability",
        category: "Retention",
        natural_language_question: "Which customers are inactive?",
        sql: "SELECT * FROM customers;",
        chart_type: "table",
        chart_config: {},
        data_source: null,
        created_at: "2026-10-20T10:00:00Z",
        updated_at: "2026-10-21T10:00:00Z",
      },
    ];

    vi.mocked(api.getSavedReports).mockResolvedValueOnce(multiCatReports);
    vi.mocked(api.getScheduledReports).mockResolvedValueOnce([]);

    render(<ReportsView />);

    await waitFor(() => {
      expect(screen.getByText("Monthly Revenue Breakdown")).toBeInTheDocument();
      expect(screen.getByText("Customer Churn Risk Report")).toBeInTheDocument();
    });

    const retentionFilter = screen.getByRole("button", { name: "Retention" });
    fireEvent.click(retentionFilter);

    expect(screen.getByText("Customer Churn Risk Report")).toBeInTheDocument();
    expect(screen.queryByText("Monthly Revenue Breakdown")).not.toBeInTheDocument();
  });

  it("recommends Bar Chart for categorical breakdown and renders axis selectors", () => {
    render(
      <ChartRecommendationView
        result={mockQueryResult}
        question="Revenue by category"
      />
    );

    expect(screen.getByRole("button", { name: /save as report/i })).toBeInTheDocument();

    const barBtn = screen.getByRole("button", { name: /bar chart/i });
    expect(barBtn).toBeInTheDocument();

    const pieBtn = screen.getByRole("button", { name: /donut/i });
    expect(pieBtn).toBeInTheDocument();
    fireEvent.click(pieBtn);

    expect(screen.getByText("Dimension (X):")).toBeInTheDocument();
    expect(screen.getByText("Metric (Y):")).toBeInTheDocument();
  });
});
