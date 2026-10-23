import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardView } from "../components/dashboard/DashboardView";
import { DashboardData } from "../types";

const mockDashboardData: DashboardData = {
  kpis: {
    total_revenue: 1875000.5,
    total_orders: 2500,
    total_customers: 250,
    avg_order_value: 750.0,
    completed_orders: 2200,
  },
  revenue_by_month: [
    { month: "2026-01", revenue: 250000, orders: 350 },
    { month: "2026-02", revenue: 310000, orders: 420 },
    { month: "2026-03", revenue: 400000, orders: 530 },
  ],
  revenue_by_country: [
    { country: "United States", revenue: 1200000, order_count: 1500 },
    { country: "Germany", revenue: 400000, order_count: 600 },
  ],
  order_status_distribution: [
    { status: "completed", count: 2200 },
    { status: "pending", count: 300 },
  ],
  customer_segmentation: [
    { customer_segment: "Enterprise", count: 50 },
    { customer_segment: "SMB", count: 120 },
    { customer_segment: "Consumer", count: 80 },
  ],
  top_products: [
    { product_id: 1, product__name: "Analytics Pro", product__category: "Software", total_units_sold: 1200, total_revenue: 600000 },
    { product_id: 2, product__name: "Cloud Storage", product__category: "Infrastructure", total_units_sold: 800, total_revenue: 200000 },
  ],
  top_customers: [
    { id: 1, name: "Acme Corp", email: "contact@acme.com", customer_segment: "Enterprise", country: "United States", lifetime_revenue: 150000, order_count: 24 },
  ],
};

describe("DashboardView Component", () => {
  it("renders loading spinner and indicator when loading is true", () => {
    render(
      <DashboardView
        data={null}
        loading={true}
        onNavigateToQuery={vi.fn()}
      />
    );

    expect(screen.getByText("Loading business metrics...")).toBeInTheDocument();
  });

  it("renders error state with retry button when error occurs", () => {
    const onRetry = vi.fn();
    render(
      <DashboardView
        data={null}
        loading={false}
        error="Failed to connect to backend service"
        onRetry={onRetry}
        onNavigateToQuery={vi.fn()}
      />
    );

    expect(screen.getByText("Failed to load dashboard metrics")).toBeInTheDocument();
    expect(screen.getByText("Failed to connect to backend service")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders KPI cards with correct formatted values on success", () => {
    render(
      <DashboardView
        data={mockDashboardData}
        loading={false}
        onNavigateToQuery={vi.fn()}
      />
    );

    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("$1,875,000.50")).toBeInTheDocument();
    expect(screen.getByText("Total Orders")).toBeInTheDocument();
    expect(screen.getByText("2,500")).toBeInTheDocument();
    expect(screen.getByText("Total Customers")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("Average Order Value")).toBeInTheDocument();
    expect(screen.getByText("$750.00")).toBeInTheDocument();
  });

  it("triggers onNavigateToQuery when quick prompt buttons are clicked", () => {
    const onNavigateToQuery = vi.fn();
    render(
      <DashboardView
        data={mockDashboardData}
        loading={false}
        onNavigateToQuery={onNavigateToQuery}
      />
    );

    const promptBtn = screen.getByRole("button", { name: /ask top customers/i });
    expect(promptBtn).toBeInTheDocument();
    fireEvent.click(promptBtn);

    expect(onNavigateToQuery).toHaveBeenCalledWith("Show the top 10 customers by revenue.");
  });
});

