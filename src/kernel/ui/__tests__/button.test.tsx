// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/kernel/ui/button";

afterEach(cleanup);

describe("Button", () => {
  it("renders its label and reacts to clicks", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Save</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("cannot be clicked while disabled", () => {
    render(<Button disabled>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
