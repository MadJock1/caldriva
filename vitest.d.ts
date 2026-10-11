import "@testing-library/jest-dom";

declare module "vitest" {
  interface Assertion<T> {
    toBeInTheDocument(): T;
    toHaveTextContent(text: string | RegExp): T;
    toBeDisabled(): T;
    toHaveBeenCalledWith(...args: unknown[]): T;
    toHaveBeenCalledTimes(count: number): T;
  }
}