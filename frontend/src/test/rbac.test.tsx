import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Navbar } from "../components/layout/Navbar";
import { QueryView } from "../components/query/QueryView";
import { DatabaseConnectionsView } from "../components/datasources/DatabaseConnectionsView";
import { TeamAccessView } from "../components/settings/TeamAccessView";
import { api } from "../services/api";
import { AIStatus, CurrentUser, DataSource, OrganizationMembership, ColumnMaskingPolicy } from "../types";

vi.mock("../services/api", () => ({
  api: {
    getDataSources: vi.fn(),
    createDataSource: vi.fn(),
    updateDataSource: vi.fn(),
    deleteDataSource: vi.fn(),
    testRawConnection: vi.fn(),
    testDataSource: vi.fn(),
    introspectDataSource: vi.fn(),
    executeQuery: vi.fn(),
    executeDirectSQL: vi.fn(),
    getOrganizations: vi.fn(),
    getOrganizationMembers: vi.fn(),
    addOrganizationMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeOrganizationMember: vi.fn(),
    getMaskingPolicies: vi.fn(),
    createMaskingPolicy: vi.fn(),
    deleteMaskingPolicy: vi.fn(),
  },
}));

const mockAIStatus: AIStatus = {
  provider: "mock_demo",
  model: "gemini-2.5-pro",
  api_key_configured: true,
  demo_mode: false,
  limits: {
    max_rows: 1000,
    max_query_seconds: 30,
    max_sql_length: 5000,
  },
};

const mockAdminUser: CurrentUser = {
  id: 1,
  name: "Alice Admin",
  email: "admin@enterprise.com",
  is_staff: true,
  active_organization: {
    id: 10,
    name: "Enterprise Alpha",
    slug: "enterprise-alpha",
    role: "ADMIN",
  },
  organizations: [
    {
      id: 10,
      name: "Enterprise Alpha",
      slug: "enterprise-alpha",
      role: "ADMIN",
    },
    {
      id: 20,
      name: "Beta Labs",
      slug: "beta-labs",
      role: "VIEWER",
    },
  ],
};

const mockAnalystUser: CurrentUser = {
  id: 2,
  name: "Bob Analyst",
  email: "analyst@enterprise.com",
  is_staff: false,
  active_organization: {
    id: 10,
    name: "Enterprise Alpha",
    slug: "enterprise-alpha",
    role: "ANALYST",
  },
  organizations: [
    {
      id: 10,
      name: "Enterprise Alpha",
      slug: "enterprise-alpha",
      role: "ANALYST",
    },
  ],
};

const mockViewerUser: CurrentUser = {
  id: 3,
  name: "Charlie Viewer",
  email: "viewer@enterprise.com",
  is_staff: false,
  active_organization: {
    id: 10,
    name: "Enterprise Alpha",
    slug: "enterprise-alpha",
    role: "VIEWER",
  },
  organizations: [
    {
      id: 10,
      name: "Enterprise Alpha",
      slug: "enterprise-alpha",
      role: "VIEWER",
    },
  ],
};

const mockMembers: OrganizationMembership[] = [
  {
    id: 101,
    user_id: 1,
    user_email: "admin@enterprise.com",
    user_name: "Alice Admin",
    role: "ADMIN",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
  {
    id: 102,
    user_id: 2,
    user_email: "analyst@enterprise.com",
    user_name: "Bob Analyst",
    role: "ANALYST",
    created_at: "2026-10-02T00:00:00Z",
    updated_at: "2026-10-02T00:00:00Z",
  },
];

const mockPolicies: ColumnMaskingPolicy[] = [
  {
    id: 1,
    rule_name: "Mask Emails",
    match_type: "EXACT",
    match_pattern: "email",
    masking_type: "EMAIL",
    is_active: true,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
];

const mockDataSources: DataSource[] = [
  {
    id: 1,
    name: "Internal Warehouse",
    engine: "postgresql",
    host: "db.internal",
    port: 5432,
    database_name: "analytics_dw",
    username: "ro_user",
    ssl_mode: "require",
    is_active: true,
    allowed_schemas: ["public"],
    allowed_tables: ["customers", "orders"],
    user: 1,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    schema_last_synced_at: "2026-10-01T00:00:00Z",
    cached_schema: {
      engine: "postgresql",
      database_name: "analytics_dw",
      schemas: ["public"],
      table_count: 2,
      synced_at: "2026-10-01T00:00:00Z",
      tables: [],
    },
  },
];

describe("Enterprise RBAC and Authorization Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getDataSources).mockResolvedValue(mockDataSources);
  });

  describe("Navbar Role and Organization Presentation", () => {
    it("renders ADMIN badge and multi-organization selector dropdown", () => {
      const handleSelectOrg = vi.fn();
      render(
        <Navbar
          aiStatus={mockAIStatus}
          onOpenQuery={vi.fn()}
          currentUser={mockAdminUser}
          onSelectOrganization={handleSelectOrg}
        />
      );

      // Verify Admin badge
      expect(screen.getByText("ADMIN")).toBeInTheDocument();
      // Verify active organization name
      expect(screen.getByDisplayValue("Enterprise Alpha")).toBeInTheDocument();

      // Switch organization
      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "20" } });
      expect(handleSelectOrg).toHaveBeenCalledWith(20);
    });

    it("renders ANALYST badge for analyst users", () => {
      render(
        <Navbar
          aiStatus={mockAIStatus}
          onOpenQuery={vi.fn()}
          currentUser={mockAnalystUser}
        />
      );

      expect(screen.getByText("ANALYST")).toBeInTheDocument();
    });

    it("renders VIEWER badge for viewer users", () => {
      render(
        <Navbar
          aiStatus={mockAIStatus}
          onOpenQuery={vi.fn()}
          currentUser={mockViewerUser}
        />
      );

      expect(screen.getByText("VIEWER")).toBeInTheDocument();
    });
  });

  describe("QueryView Viewer Lock & Analyst Access", () => {
    it("locks Direct SQL and disables query execution when user is VIEWER", async () => {
      render(<QueryView userRole="VIEWER" />);

      // Verify Viewer Access Restricted notice
      expect(
        screen.getByText(/Ad-hoc query execution and Direct SQL are restricted for Viewers/i)
      ).toBeInTheDocument();

      // Direct SQL lock indicator should be displayed
      expect(screen.getByText("Direct SQL (Analysts/Admins Only)")).toBeInTheDocument();

      // Query input textarea should be disabled
      const textarea = screen.getByPlaceholderText(/Ad-hoc query execution is restricted for Viewers/i);
      expect(textarea).toBeDisabled();

      // Ask AI button should be disabled
      const askBtn = screen.getByText("Generate & Execute");
      expect(askBtn.closest("button")).toBeDisabled();
    });

    it("permits query execution and Direct SQL toggling when user is ANALYST", async () => {
      render(<QueryView userRole="ANALYST" />);

      expect(
        screen.queryByText(/Ad-hoc query execution and Direct SQL are restricted for Viewers/i)
      ).not.toBeInTheDocument();

      const directSqlBtn = screen.getByText("Direct SQL Mode");
      expect(directSqlBtn.closest("button")).not.toBeDisabled();

      // Toggling to Direct SQL
      fireEvent.click(directSqlBtn);
      expect(screen.getByText("Switch to Natural Language")).toBeInTheDocument();
    });
  });

  describe("DatabaseConnectionsView Admin Guard", () => {
    it("disables 'Add Connection' and hides Edit/Delete for non-Admin users", async () => {
      render(<DatabaseConnectionsView userRole="ANALYST" />);

      await waitFor(() => {
        expect(screen.getByText("Internal Warehouse")).toBeInTheDocument();
      });

      // Non-admins see lock pill and no Add Connection button
      expect(screen.getByText("Connection Management (Admin Only)")).toBeInTheDocument();
      expect(screen.queryByText("Add Connection")).not.toBeInTheDocument();

      // Non-admins should not see edit/delete buttons
      expect(screen.queryByTitle("Edit Connection")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Delete Connection")).not.toBeInTheDocument();
    });

    it("enables 'Add Connection' and shows actions for ADMIN users", async () => {
      render(<DatabaseConnectionsView userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("Internal Warehouse")).toBeInTheDocument();
      });

      const addBtn = screen.getByText("Add Connection");
      expect(addBtn.closest("button")).not.toBeDisabled();
      expect(screen.queryByText("Connection Management (Admin Only)")).not.toBeInTheDocument();

      // Edit and delete buttons are rendered
      expect(screen.getByTitle("Edit Connection")).toBeInTheDocument();
      expect(screen.getByTitle("Delete Connection")).toBeInTheDocument();
    });
  });

  describe("TeamAccessView Member & Masking Management", () => {
    it("renders members table and masking policies for ADMIN", async () => {
      vi.mocked(api.getOrganizationMembers).mockResolvedValue(mockMembers);
      vi.mocked(api.getMaskingPolicies).mockResolvedValue(mockPolicies);

      render(<TeamAccessView activeOrgId={10} userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("Alice Admin")).toBeInTheDocument();
        expect(screen.getByText("Bob Analyst")).toBeInTheDocument();
      });

      // Masking policy visible
      expect(screen.getByText("Mask Emails")).toBeInTheDocument();

      // Add member form present
      expect(screen.getByPlaceholderText("colleague@example.com")).toBeInTheDocument();
      expect(screen.getByText("Add Member")).toBeInTheDocument();
    });

    it("renders Admin Permissions Required guard for VIEWER", () => {
      render(<TeamAccessView activeOrgId={10} userRole="VIEWER" />);

      expect(screen.getByText("Team & Access Management Restricted")).toBeInTheDocument();
      expect(
        screen.getByText(/Only Organization Administrators have permission/i)
      ).toBeInTheDocument();
    });
  });
});

