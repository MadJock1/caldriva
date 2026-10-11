import "@testing-library/jest-dom";
import { vi } from "vitest";

Object.defineProperty(global, "fetch", {
  writable: true,
  value: vi.fn(),
});