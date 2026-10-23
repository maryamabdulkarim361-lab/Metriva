import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DatabaseConnectionsView } from "../components/datasources/DatabaseConnectionsView";
import { api } from "../services/api";
import { DataSource } from "../types";

vi.mock("../services/api", () => ({
  api: {
    getDataSources: vi.fn(),
    createDataSource: vi.fn(),
    updateDataSource: vi.fn(),
    deleteDataSource: vi.fn(),
    testRawConnection: vi.fn(),
    testDataSource: vi.fn(),
    introspectDataSource: vi.fn(),
  },
}));

const mockDataSources: DataSource[] = [
  {
    id: 1,
    name: "Production Replica",
    engine: "postgresql",
    host: "postgres-replica.internal",
    port: 5432,
    database_name: "prod_db",
    username: "readonly_user",
    ssl_mode: "require",
    is_active: true,
    allowed_schemas: ["public"],
    allowed_tables: ["customers", "orders"],
    schema_last_synced_at: "2026-10-20T12:00:00Z",
    user: 1,
    created_at: "2026-10-20T12:00:00Z",
    updated_at: "2026-10-20T12:00:00Z",
    cached_schema: {
      engine: "postgresql",
      database_name: "prod_db",
      schemas: ["public"],
      table_count: 1,
      synced_at: "2026-10-20T12:00:00Z",
      tables: [
        {
          schema: "public",
          name: "customers",
          columns: [{ name: "id", type: "integer", nullable: false, primary_key: true, is_sensitive: false }],
          primary_keys: ["id"],
          foreign_keys: [],
        },
      ],
    },
  },
];

describe("DatabaseConnectionsView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and renders existing database connections", async () => {
    vi.mocked(api.getDataSources).mockResolvedValueOnce(mockDataSources);

    render(<DatabaseConnectionsView />);

    await waitFor(() => {
      expect(screen.getByText("Production Replica")).toBeInTheDocument();
      expect(screen.getByText("postgresql")).toBeInTheDocument();
      expect(screen.getByText("prod_db")).toBeInTheDocument();
      expect(screen.getByText("postgres-replica.internal:5432")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("opens add connection modal with appropriate default inputs", async () => {
    vi.mocked(api.getDataSources).mockResolvedValueOnce([]);

    render(<DatabaseConnectionsView />);

    await waitFor(() => {
      expect(screen.getByText("No external databases connected")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: /add connection/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("Add Database Connection")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Production Replica, Analytics DW")).toBeInTheDocument();
  });

  it("executes connection test and renders result", async () => {
    vi.mocked(api.getDataSources).mockResolvedValueOnce([]);
    vi.mocked(api.testRawConnection).mockResolvedValueOnce({
      success: true,
      message: "Connected to PostgreSQL database prod_db successfully (8.4ms).",
      latency_ms: 8.4,
    });

    render(<DatabaseConnectionsView />);

    await waitFor(() => {
      expect(screen.getByText("No external databases connected")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add connection/i }));

    fireEvent.change(screen.getByPlaceholderText("e.g. Production Replica, Analytics DW"), {
      target: { value: "Test Postgres DB" },
    });
    fireEvent.change(screen.getByPlaceholderText("app_production"), {
      target: { value: "prod_db" },
    });

    const testBtn = screen.getByRole("button", { name: /test connection/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(api.testRawConnection).toHaveBeenCalled();
      expect(screen.getByText("Connection Verified")).toBeInTheDocument();
      expect(screen.getByText(/Connected to PostgreSQL database prod_db successfully/i)).toBeInTheDocument();
    });
  });
});
