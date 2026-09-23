// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UserList } from "../UserList";

afterEach(cleanup);

describe("UserList", () => {
  it("shows an empty message when there are no users", () => {
    render(<UserList users={[]} />);

    expect(screen.getByText("No users yet.")).toBeInTheDocument();
  });

  it("lists each user's name and email", () => {
    render(
      <UserList users={[{ id: "1", name: "Ada", email: "ada@example.com" }]} />,
    );

    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });
});
