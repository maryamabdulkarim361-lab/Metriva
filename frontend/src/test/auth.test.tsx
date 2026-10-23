import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthModal } from "../components/auth/AuthModal";
import { Navbar } from "../components/layout/Navbar";
import { api, getAuthToken, setAuthToken } from "../services/api";
import { AIStatus } from "../types";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<any>("../services/api");
  let mockToken: string | null = null;
  return {
    ...actual,
    getAuthToken: vi.fn(() => mockToken),
    setAuthToken: vi.fn((token: string | null) => {
      mockToken = token;
    }),
    api: {
      ...actual.api,
      login: vi.fn(),
      register: vi.fn(),
      getCurrentUser: vi.fn(),
      logout: vi.fn(),
    },
  };
});

describe("Authentication & Session Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Login modal with email and password fields when open", () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Sign In to AI Database")).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("does not render modal when isOpen is false", () => {
    render(<AuthModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("switches to registration mode when Register tab is clicked", () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} />);
    const registerTab = screen.getByRole("button", { name: "Register" });
    fireEvent.click(registerTab);

    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
  });

  it("successfully signs in user on valid credentials", async () => {
    const mockUser = { id: 1, email: "analyst@company.com", name: "Data Analyst" };
    vi.mocked(api.login).mockResolvedValueOnce({
      tokens: { access: "jwt.access.token", refresh: "jwt.refresh.token" },
      user: mockUser,
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(<AuthModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "analyst@company.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPassword123!" },
    });

    fireEvent.click(screen.getByTestId("auth-submit-btn"));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({
        email: "analyst@company.com",
        password: "StrongPassword123!",
      });
      expect(screen.getByText("Authentication successful!")).toBeInTheDocument();
    });
  });

  it("displays server error message on invalid credentials", async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new Error("Invalid email or password."));

    render(<AuthModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "wrong@company.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "WrongPassword!" },
    });

    fireEvent.click(screen.getByTestId("auth-submit-btn"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
    });
  });

const mockAIStatus: AIStatus = {
  provider: "mock_demo",
  model: "deterministic",
  api_key_configured: true,
  demo_mode: true,
  limits: {
    max_rows: 1000,
    max_query_seconds: 10,
    max_sql_length: 10000,
  },
};

  it("renders Sign In button on Navbar when unauthenticated", () => {
    const onOpenAuth = vi.fn();
    render(
      <Navbar
        aiStatus={mockAIStatus}
        onOpenQuery={vi.fn()}
        currentUser={null}
        onOpenAuth={onOpenAuth}
      />
    );

    const signInBtn = screen.getByRole("button", { name: /sign in/i });
    expect(signInBtn).toBeInTheDocument();
    fireEvent.click(signInBtn);
    expect(onOpenAuth).toHaveBeenCalledTimes(1);
  });

  it("renders user badge and sign-out button on Navbar when authenticated", () => {
    const onLogout = vi.fn();
    render(
      <Navbar
        aiStatus={mockAIStatus}
        onOpenQuery={vi.fn()}
        currentUser={{ name: "Lead Analyst", email: "lead@company.com" }}
        onLogout={onLogout}
      />
    );

    expect(screen.getByText("Lead Analyst")).toBeInTheDocument();
    const signOutBtn = screen.getByRole("button", { name: "Sign out" });
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
