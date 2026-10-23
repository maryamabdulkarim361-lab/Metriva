import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { METRIVA_BRAND, METRIVA_TOKENS } from "../theme/tokens";
import { MetrivaBadge, MetrivaButton, MetrivaCard, MetrivaLogo } from "../components/ui";

describe("Metriva Design System & Branding Tokens", () => {
  it("exposes standardized Metriva brand identity constants", () => {
    expect(METRIVA_BRAND.name).toBe("Metriva");
    expect(METRIVA_BRAND.tagline).toBe("Turn Business Data Into Clarity.");
    expect(METRIVA_BRAND.positioning).toContain("AI-powered business intelligence");
    expect(METRIVA_TOKENS.colors.cyanPrimary).toBe("#06B6D4");
    expect(METRIVA_TOKENS.colors.bgDarkest).toBe("#070B14");
  });

  it("renders MetrivaLogo with stylized geometry and accessible branding", () => {
    const { rerender } = render(<MetrivaLogo size="md" showTagline={false} />);
    expect(screen.getByText("Metriva")).toBeInTheDocument();

    rerender(<MetrivaLogo size="lg" showTagline={true} />);
    expect(screen.getByText("Turn Business Data Into Clarity")).toBeInTheDocument();
  });

  it("renders MetrivaButton with primary glow, loading state, and handles click events", () => {
    let clicked = false;
    const { rerender } = render(
      <MetrivaButton
        variant="primary"
        size="md"
        onClick={() => {
          clicked = true;
        }}
      >
        Launch Platform
      </MetrivaButton>
    );

    const button = screen.getByRole("button", { name: /launch platform/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(clicked).toBe(true);

    // Test loading state
    rerender(
      <MetrivaButton variant="primary" loading>
        Launch Platform
      </MetrivaButton>
    );
    expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders MetrivaBadge with pulse indicator and semantic variants", () => {
    render(
      <MetrivaBadge variant="emerald" pulse>
        Read-Only Active
      </MetrivaBadge>
    );

    expect(screen.getByText("Read-Only Active")).toBeInTheDocument();
  });

  it("renders MetrivaCard with dark surface and hover glow", () => {
    render(
      <MetrivaCard glow hoverGlow>
        <div data-testid="card-child">Analytics Content</div>
      </MetrivaCard>
    );

    expect(screen.getByTestId("card-child")).toBeInTheDocument();
  });
});

