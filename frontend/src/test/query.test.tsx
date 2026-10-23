import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryView } from "../components/query/QueryView";
import { api } from "../services/api";
import { QueryExecutionResult } from "../types";

vi.mock("../services/api", () => ({
  api: {
    askQuestion: vi.fn(),
    executeDirectSQL: vi.fn(),
    getDataSources: vi.fn().mockResolvedValue([]),
    createSavedReport: vi.fn(),
  },
}));

const mockSuccessResult: QueryExecutionResult = {
  question: "Show top customers",
  sql: "SELECT name, lifetime_revenue FROM customers ORDER BY lifetime_revenue DESC LIMIT 5;",
  columns: ["name", "lifetime_revenue"],
  rows: [
    ["Acme Corp", 150000],
    ["Global Logistics", 120000],
  ],
  row_count: 2,
  execution_time_ms: 12.4,
  explanation: "Retrieved highest value accounts based on completed orders.",
  query_history_id: 101,
};

describe("QueryView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders natural language input and example queries by default", () => {
    render(<QueryView />);

    expect(screen.getByPlaceholderText(/Ask anything about customers/i)).toBeInTheDocument();
    expect(screen.getByText("Suggested Analytical Questions:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate & execute/i })).toBeInTheDocument();
  });

  it("populates textarea when an example query is clicked", async () => {
    vi.mocked(api.askQuestion).mockResolvedValueOnce(mockSuccessResult);

    render(<QueryView />);

    const examplePill = screen.getByText("Show the top 10 customers by revenue.");
    fireEvent.click(examplePill);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Ask anything about customers/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe("Show the top 10 customers by revenue.");
    });
  });

  it("submits question and renders successful result set and explanation", async () => {
    vi.mocked(api.askQuestion).mockResolvedValueOnce(mockSuccessResult);

    render(<QueryView initialQuestion="Show top customers" />);

    const submitBtn = screen.getByRole("button", { name: /generate & execute/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.askQuestion).toHaveBeenCalledWith("Show top customers", false, null);
      expect(screen.getAllByText("Acme Corp").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Global Logistics").length).toBeGreaterThan(0);
      expect(screen.getAllByText("150,000").length).toBeGreaterThan(0);
      expect(screen.getByText(/Retrieved highest value accounts/i)).toBeInTheDocument();
    });
  });

  it("toggles to Direct SQL Mode and executes raw query", async () => {
    vi.mocked(api.executeDirectSQL).mockResolvedValueOnce(mockSuccessResult);

    render(<QueryView initialQuestion="SELECT * FROM customers LIMIT 2;" />);

    const modeBtn = screen.getByRole("button", { name: /direct sql mode/i });
    fireEvent.click(modeBtn);

    expect(screen.getByText(/Direct SQL Query/i)).toBeInTheDocument();

    const sqlTextarea = screen.getByPlaceholderText(/SELECT c.name, SUM\(o.total_amount\)/i);
    fireEvent.change(sqlTextarea, {
      target: { value: "SELECT * FROM customers LIMIT 2;" },
    });

    const runBtn = screen.getByRole("button", { name: /validate & execute sql/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(api.executeDirectSQL).toHaveBeenCalledWith(
        "SELECT * FROM customers LIMIT 2;",
        "Direct SQL Query",
        null
      );
      expect(screen.getAllByText("Acme Corp").length).toBeGreaterThan(0);
    });
  });

  it("clears previous results and updates table and CSV export on new query execution", async () => {
    // 1. Initial 10-row result
    const initial10RowsResult: QueryExecutionResult = {
      question: "Show accounts",
      sql: "SELECT id, account_name, industry, plan_tier, status, mrr_amount FROM accounts LIMIT 10;",
      columns: ["id", "account_name", "industry", "plan_tier", "status", "mrr_amount"],
      rows: Array.from({ length: 10 }, (_, i) => [i + 1, `Company ${i + 1}`, "Tech", "Enterprise", "active", 1000 * (i + 1)]),
      row_count: 10,
      execution_time_ms: 15.2,
      explanation: "Found 10 accounts.",
    };

    // 2. Subsequent 3-row Direct SQL result
    const new3RowsResult: QueryExecutionResult = {
      question: "Direct SQL Query",
      sql: "SELECT account_name, mrr_amount FROM accounts ORDER BY mrr_amount DESC LIMIT 3;",
      columns: ["account_name", "mrr_amount"],
      rows: [
        ["Polaris Systems", 9200.0],
        ["Vanguard Financial", 8400.0],
        ["Hyperion Health", 7200.0],
      ],
      row_count: 3,
      execution_time_ms: 2.1,
      explanation: "",
    };

    vi.mocked(api.askQuestion).mockResolvedValueOnce(initial10RowsResult);
    vi.mocked(api.executeDirectSQL).mockResolvedValueOnce(new3RowsResult);

    render(<QueryView initialQuestion="Show accounts" />);

    // Execute first query
    const submitBtn = screen.getByRole("button", { name: /generate & execute/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("10 rows returned")).toBeInTheDocument();
      expect(screen.getByText("Company 1")).toBeInTheDocument();
      expect(screen.getByText("Company 10")).toBeInTheDocument();
    });

    // Switch to Direct SQL Mode and execute exact 3-row query
    const modeBtn = screen.getByRole("button", { name: /direct sql mode/i });
    fireEvent.click(modeBtn);

    const sqlTextarea = screen.getByPlaceholderText(/SELECT c.name, SUM\(o.total_amount\)/i);
    fireEvent.change(sqlTextarea, {
      target: {
        value: "SELECT account_name, mrr_amount FROM accounts ORDER BY mrr_amount DESC LIMIT 3;",
      },
    });

    // Test Cmd + Enter shortcut
    fireEvent.keyDown(sqlTextarea, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(api.executeDirectSQL).toHaveBeenCalledWith(
        "SELECT account_name, mrr_amount FROM accounts ORDER BY mrr_amount DESC LIMIT 3;",
        "Direct SQL Query",
        null
      );
      // Verify stale rows are replaced
      expect(screen.queryByText("Company 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Company 10")).not.toBeInTheDocument();
      // Verify new rows and columns are displayed
      expect(screen.getByText("3 rows returned")).toBeInTheDocument();
      expect(screen.getByText("Polaris Systems")).toBeInTheDocument();
      expect(screen.getByText("Vanguard Financial")).toBeInTheDocument();
      expect(screen.getByText("Hyperion Health")).toBeInTheDocument();
      expect(screen.getByText("9,200")).toBeInTheDocument();
    });

    // Verify CSV export uses fresh 3-row result
    const exportBtn = screen.getByRole("button", { name: /export csv/i });
    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => null as any);
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => null as any);

    let createdHref = "";
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName === "a") {
        el.click = vi.fn();
        const origSetAttr = el.setAttribute.bind(el);
        el.setAttribute = vi.fn((k, v) => {
          if (k === "href") createdHref = v;
          return origSetAttr(k, v);
        });
      }
      return el;
    });

    fireEvent.click(exportBtn);

    expect(createdHref).toContain("account_name,mrr_amount");
    expect(createdHref).toContain("Polaris%20Systems,9200");
    expect(createdHref).not.toContain("Company 10");

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("renders security error banner when query is blocked", async () => {
    const errorObj = new Error("Query rejected: Only read-only SELECT statements are permitted.");
    (errorObj as any).code = "FORBIDDEN_OPERATION";

    vi.mocked(api.askQuestion).mockRejectedValueOnce(errorObj);

    render(<QueryView initialQuestion="DROP TABLE customers;" />);

    const submitBtn = screen.getByRole("button", { name: /generate & execute/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Query Blocked / Failed")).toBeInTheDocument();
      expect(
        screen.getByText(/Only read-only SELECT statements are permitted/i)
      ).toBeInTheDocument();
      expect(screen.getByText("FORBIDDEN_OPERATION")).toBeInTheDocument();
    });
  });
});

