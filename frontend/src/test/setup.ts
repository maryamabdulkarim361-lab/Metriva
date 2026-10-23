import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock ResizeObserver which is not present in JSDOM but needed by Recharts
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = MockResizeObserver;
(window as any).ResizeObserver = MockResizeObserver;

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Suppress known Recharts responsive container warning in jsdom (width=0 / height=0)
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("The width(0) and height(0) of chart should be greater than 0") ||
     args[0].includes("ResponsiveContainer"))
  ) {
    return;
  }
  originalConsoleWarn(...args);
};
