import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LandingPage } from "../components/landing/LandingPage";
import { App } from "../App";

// Mock API calls made by App component
vi.mock("../services/api", () => {
  return {
    getAuthToken: vi.fn().mockReturnValue(null),
    setAuthToken: vi.fn(),
    api: {
      getAIStatus: vi.fn().mockResolvedValue({
        model: "openai/gpt-4o-mini",
        provider: "openai",
        demo_mode: false,
        read_only_enforced: true,
      }),
      getDashboardData: vi.fn().mockResolvedValue({
        summary: {
          total_revenue: 125430.5,
          total_orders: 2500,
          total_customers: 250,
          avg_order_value: 50.17,
        },
        revenue_trend: [],
        top_products: [],
        recent_queries: [],
      }),
      getDataSources: vi.fn().mockResolvedValue([]),
      getSavedReports: vi.fn().mockResolvedValue([]),
      getMetricsDefinitions: vi.fn().mockResolvedValue([]),
      getComparisonData: vi.fn().mockResolvedValue({ data: [], summary: { observed_facts: [] } }),
      getSchemaMetadata: vi.fn().mockResolvedValue({ tables: [], relationships: [] }),
    },
  };
});

describe("Metriva Marketing Landing Page & Interactive Simulator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the hero section with Metriva branding, tagline, and positioning", () => {
    render(
      <LandingPage
        onLaunchApp={vi.fn()}
        onOpenAuth={vi.fn()}
        onNavigateToQueryWithPrompt={vi.fn()}
      />
    );

    // Hero title & Tagline
    expect(
      screen.getByRole("heading", { level: 1, name: /Turn Business Data/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Into Clarity\./i)).toBeInTheDocument();

    // Positioning
    expect(
      screen.getAllByText(/AI-powered business intelligence for non-technical businesses/i)[0]
    ).toBeInTheDocument();

    // Security & verified badges
    expect(screen.getByText("Read-Only Guard")).toBeInTheDocument();
    expect(screen.getByText("Multi-Engine DB")).toBeInTheDocument();
  });

  it("renders the interactive analytics simulator and switches scenarios and tabs", async () => {
    render(
      <LandingPage
        onLaunchApp={vi.fn()}
        onOpenAuth={vi.fn()}
        onNavigateToQueryWithPrompt={vi.fn()}
      />
    );

    // Check default scenario (Revenue by Category)
    expect(
      screen.getByText(/What is our total revenue breakdown by product category/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Total Net Revenue")).toBeInTheDocument();

    // Toggle to Monthly Order Velocity scenario
    const growthBtn = screen.getByRole("button", { name: /Monthly Order Velocity/i });
    fireEvent.click(growthBtn);
    expect(
      screen.getByText(/Show monthly revenue progression and order volume/i)
    ).toBeInTheDocument();
    expect(screen.getByText("6-Month Growth")).toBeInTheDocument();

    // Switch tab to Generated SQL
    const sqlTabBtn = screen.getByRole("button", { name: /Generated SQL/i });
    fireEvent.click(sqlTabBtn);
    expect(screen.getByText(/SELECT/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy SQL/i })).toBeInTheDocument();
  });

  it("renders product story (Connect -> Ask -> Understand) and feature showcase", () => {
    render(
      <LandingPage
        onLaunchApp={vi.fn()}
        onOpenAuth={vi.fn()}
        onNavigateToQueryWithPrompt={vi.fn()}
      />
    );

    // Product Story
    expect(screen.getByRole("heading", { level: 3, name: "Connect" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Ask" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Understand" })).toBeInTheDocument();

    // Features
    expect(screen.getByText("Natural Language SQL Engine")).toBeInTheDocument();
    expect(screen.getByText("Automated Chart Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Predictive Machine Learning Layer")).toBeInTheDocument();
  });

  it("renders zero-trust security architecture and verified safeguards", () => {
    render(
      <LandingPage
        onLaunchApp={vi.fn()}
        onOpenAuth={vi.fn()}
        onNavigateToQueryWithPrompt={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Strict Read-Only Enforcement" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "AST-Level SQL Validation" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Fernet AES-256 Key Encryption" })
    ).toBeInTheDocument();
    expect(screen.getByText("Security Hardening Baseline Passed")).toBeInTheDocument();
  });

  it("triggers onLaunchApp callback when Launch Platform CTA is clicked", () => {
    const onLaunchApp = vi.fn();
    render(
      <LandingPage
        onLaunchApp={onLaunchApp}
        onOpenAuth={vi.fn()}
        onNavigateToQueryWithPrompt={vi.fn()}
      />
    );

    const launchBtns = screen.getAllByRole("button", { name: /Launch Platform/i });
    fireEvent.click(launchBtns[0]);
    expect(onLaunchApp).toHaveBeenCalledTimes(1);
  });

  it("seamlessly transitions from Landing Page to Live App with simulated query in App component", async () => {
    render(<App initialView="landing" />);

    // Starts on Landing Page
    expect(
      screen.getByRole("heading", { level: 1, name: /Turn Business Data/i })
    ).toBeInTheDocument();

    // Click "Run Live In App" from the interactive simulator
    const runLiveBtn = screen.getByRole("button", { name: /Run Live In App/i });
    fireEvent.click(runLiveBtn);

    // Should switch to App shell and load QueryView with pre-populated prompt
    await waitFor(() => {
      expect(screen.getByText("Natural Language Query Interface")).toBeInTheDocument();
    });
  });
});
