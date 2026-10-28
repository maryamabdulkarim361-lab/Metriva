import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../App";
import { api, getAuthToken, setAuthToken, setActiveOrgId, setRefreshToken } from "../services/api";

let mockStorage: Record<string, string> = {};

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<any>("../services/api");
  return {
    ...actual,
    getAuthToken: vi.fn(() => mockStorage["aidb_access_token"] || null),
    setAuthToken: vi.fn((token: string | null) => {
      if (token) mockStorage["aidb_access_token"] = token;
      else delete mockStorage["aidb_access_token"];
    }),
    getRefreshToken: vi.fn(() => mockStorage["aidb_refresh_token"] || null),
    setRefreshToken: vi.fn((token: string | null) => {
      if (token) mockStorage["aidb_refresh_token"] = token;
      else delete mockStorage["aidb_refresh_token"];
    }),
    getActiveOrgId: vi.fn(() => {
      const v = mockStorage["aidb_active_org_id"];
      return v ? parseInt(v, 10) : null;
    }),
    setActiveOrgId: vi.fn((id: number | null) => {
      if (id !== null) mockStorage["aidb_active_org_id"] = String(id);
      else delete mockStorage["aidb_active_org_id"];
    }),
    api: {
      ...actual.api,
      getAIStatus: vi.fn().mockResolvedValue({
        provider: "mock",
        model: "deterministic",
        demo_mode: true,
        is_healthy: true,
      }),
      getCurrentUser: vi.fn().mockResolvedValue(null),
      getDashboardData: vi.fn().mockResolvedValue({
        kpis: {
          total_revenue: 0,
          total_orders: 0,
          total_customers: 0,
          avg_order_value: 0,
          completed_orders: 0,
        },
        revenue_by_month: [],
        revenue_by_country: [],
        order_status_distribution: [],
        customer_segmentation: [],
        top_products: [],
        top_customers: [],
      }),
      getDataSources: vi.fn().mockResolvedValue([]),
      logout: vi.fn(() => {
        delete mockStorage["aidb_access_token"];
        delete mockStorage["aidb_refresh_token"];
        delete mockStorage["aidb_active_org_id"];
        delete mockStorage["metriva_selected_datasource_id"];
      }),
    },
  };
});

describe("Logout Redirection, Session Security & Data Isolation", () => {
  beforeEach(() => {
    mockStorage = {
      aidb_access_token: "jwt.access.token.userA",
      aidb_refresh_token: "jwt.refresh.token.userA",
      aidb_active_org_id: "1",
      metriva_selected_datasource_id: "101",
    };
    window.location.hash = "#/app/dashboard";
    vi.clearAllMocks();
  });

  it("navigates immediately to public landing page and clears session storage on logout", async () => {
    const userA = {
      id: 1,
      email: "admin@metriva.local",
      name: "Demo Admin",
      is_staff: true,
      active_organization: { id: 1, name: "Metriva Demo Org", role: "ADMIN" },
      organizations: [{ id: 1, name: "Metriva Demo Org", role: "ADMIN" }],
    };

    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(userA);
    vi.mocked(api.getDashboardData).mockResolvedValueOnce({
      kpis: {
        total_revenue: 2767200,
        total_orders: 2500,
        total_customers: 250,
        avg_order_value: 1106,
        completed_orders: 2200,
      },
      revenue_by_month: [],
      revenue_by_country: [],
      order_status_distribution: [],
      customer_segmentation: [],
      top_products: [],
      top_customers: [],
    });

    render(<App initialView="app" />);

    // 1. Verify authenticated user header appears
    await waitFor(() => {
      expect(screen.getByText("Demo Admin")).toBeInTheDocument();
      expect(screen.getByText("Metriva Demo Org")).toBeInTheDocument();
    });

    // 2. Click Sign out
    const signOutBtn = screen.getByRole("button", { name: "Sign out" });
    expect(signOutBtn).toBeInTheDocument();
    fireEvent.click(signOutBtn);

    // 3. Confirm API logout was invoked and storage keys were cleared
    expect(api.logout).toHaveBeenCalled();
    expect(mockStorage["aidb_access_token"]).toBeUndefined();
    expect(mockStorage["aidb_refresh_token"]).toBeUndefined();
    expect(mockStorage["aidb_active_org_id"]).toBeUndefined();
    expect(mockStorage["metriva_selected_datasource_id"]).toBeUndefined();

    // 4. Confirm transition to public landing page
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /Turn Business Data/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/Into Clarity\./i)).toBeInTheDocument();
    });

    // 5. Confirm URL hash reset to safe public route
    expect(window.location.hash).toBe("#/");

    // 6. Confirm login modal is not displayed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("guards protected route when hash change attempts navigation to #/app while unauthenticated", async () => {
    // Empty storage (logged out)
    mockStorage = {};
    window.location.hash = "#/";

    render(<App initialView="landing" />);

    // Starts on landing
    expect(
      screen.getByRole("heading", { level: 1, name: /Turn Business Data/i })
    ).toBeInTheDocument();

    // Attempt direct or browser back navigation to protected route
    window.location.hash = "#/app/datasources";
    fireEvent(window, new HashChangeEvent("hashchange"));

    // Guard prevents accessing app shell and preserves landing page
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /Turn Business Data/i })
      ).toBeInTheDocument();
    });
    expect(window.location.hash).toBe("#/");
  });

  it("synchronizes logout across multiple tabs when storage event fires", async () => {
    const userA = {
      id: 1,
      email: "admin@metriva.local",
      name: "Demo Admin",
      is_staff: true,
      active_organization: { id: 1, name: "Metriva Demo Org", role: "ADMIN" },
    };

    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(userA);
    vi.mocked(api.getDashboardData).mockResolvedValueOnce({
      kpis: {
        total_revenue: 2767200,
        total_orders: 2500,
        total_customers: 250,
        avg_order_value: 1106,
        completed_orders: 2200,
      },
      revenue_by_month: [],
      revenue_by_country: [],
      order_status_distribution: [],
      customer_segmentation: [],
      top_products: [],
      top_customers: [],
    });

    render(<App initialView="app" />);

    await waitFor(() => {
      expect(screen.getByText("Demo Admin")).toBeInTheDocument();
    });

    // Simulate another browser tab logging out (token removed from localStorage)
    delete mockStorage["aidb_access_token"];
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: "aidb_access_token",
        newValue: null,
      })
    );

    // Cross-tab logout handler transitions to landing page immediately
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /Turn Business Data/i })
      ).toBeInTheDocument();
    });
    expect(window.location.hash).toBe("#/");
  });

  it("handles 401 Unauthorized API responses by resetting session to landing page", async () => {
    const userA = {
      id: 1,
      email: "admin@metriva.local",
      name: "Demo Admin",
      is_staff: true,
      active_organization: { id: 1, name: "Metriva Demo Org", role: "ADMIN" },
    };

    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(userA);
    vi.mocked(api.getDashboardData).mockResolvedValueOnce({
      kpis: {
        total_revenue: 2767200,
        total_orders: 2500,
        total_customers: 250,
        avg_order_value: 1106,
        completed_orders: 2200,
      },
      revenue_by_month: [],
      revenue_by_country: [],
      order_status_distribution: [],
      customer_segmentation: [],
      top_products: [],
      top_customers: [],
    });

    render(<App initialView="app" />);

    await waitFor(() => {
      expect(screen.getByText("Demo Admin")).toBeInTheDocument();
    });

    // Dispatch 401 unauthorized event triggered by expired token
    window.dispatchEvent(new CustomEvent("metriva:unauthorized"));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /Turn Business Data/i })
      ).toBeInTheDocument();
    });
    expect(window.location.hash).toBe("#/");
  });

  it("isolates two consecutive user sessions without leaking organizations or stale records", async () => {
    // --- USER A SESSION ---
    const userA = {
      id: 1,
      email: "admin@metriva.local",
      name: "Demo Admin",
      active_organization: { id: 1, name: "Metriva Demo Org", role: "ADMIN" },
    };

    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(userA);
    vi.mocked(api.getDashboardData).mockResolvedValueOnce({
      kpis: {
        total_revenue: 2767200,
        total_orders: 2500,
        total_customers: 250,
        avg_order_value: 1106,
        completed_orders: 2200,
      },
      revenue_by_month: [],
      revenue_by_country: [],
      order_status_distribution: [],
      customer_segmentation: [],
      top_products: [],
      top_customers: [],
    });

    const { unmount } = render(<App initialView="app" />);

    await waitFor(() => {
      expect(screen.getByText("Demo Admin")).toBeInTheDocument();
      expect(screen.getByText("Metriva Demo Org")).toBeInTheDocument();
    });

    // User A signs out
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /Turn Business Data/i })
      ).toBeInTheDocument();
    });

    unmount();

    // --- USER B SESSION (Faisal) ---
    mockStorage = {
      aidb_access_token: "jwt.access.token.faisal",
      aidb_active_org_id: "5",
    };
    window.location.hash = "#/app/dashboard";

    const userB = {
      id: 10,
      email: "faisal@aidatabaseassistant.com",
      name: "Faisal",
      active_organization: { id: 5, name: "faisal's Workspace", role: "ADMIN" },
    };

    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(userB);
    vi.mocked(api.getDashboardData).mockResolvedValueOnce({
      kpis: {
        total_revenue: 0,
        total_orders: 0,
        total_customers: 0,
        avg_order_value: 0,
        completed_orders: 0,
      },
      revenue_by_month: [],
      revenue_by_country: [],
      order_status_distribution: [],
      customer_segmentation: [],
      top_products: [],
      top_customers: [],
    });

    render(<App initialView="app" />);

    // Verify User B has their own identity and workspace
    await waitFor(() => {
      expect(screen.getByText("Faisal")).toBeInTheDocument();
      expect(screen.getByText("faisal's Workspace")).toBeInTheDocument();
    });

    // Verify User A's organization name is not rendered
    expect(screen.queryByText("Metriva Demo Org")).not.toBeInTheDocument();
  });
});
