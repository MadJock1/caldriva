import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it("names the emblem for assistive technology in symbol form", () => {
    render(<Logo variant="symbol" />);
    expect(screen.getByRole("img", { name: "CALDRIVA Engineering & Technology" })).toBeInTheDocument();
  });

  it("renders the wordmark and descriptor in the horizontal lockup", () => {
    render(<Logo variant="horizontal" />);
    expect(screen.getByText("CALDRIVA")).toBeInTheDocument();
    expect(screen.getByText("Engineering & Technology")).toBeInTheDocument();
  });

  it("hides the decorative emblem when a wordmark carries the name", () => {
    const { container } = render(<Logo variant="stacked" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("can omit the descriptor", () => {
    render(<Logo descriptor={false} />);
    expect(screen.queryByText("Engineering & Technology")).not.toBeInTheDocument();
  });
});
