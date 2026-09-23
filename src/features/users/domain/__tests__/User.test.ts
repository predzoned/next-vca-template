import { describe, expect, it } from "vitest";
import { InvalidUserError } from "../errors";
import { User } from "../User";
import type { UserId } from "../UserId";

const ID = "user-1" as UserId;

describe("User.create", () => {
  it("normalizes the name and email", () => {
    const user = User.create({
      id: ID,
      name: "  Ada ",
      email: " Ada@Example.com ",
    });

    expect(user.name).toBe("Ada");
    expect(user.email).toBe("ada@example.com");
  });

  it("refuses an empty name", () => {
    expect(() =>
      User.create({ id: ID, name: "  ", email: "ada@example.com" }),
    ).toThrow(InvalidUserError);
  });

  it("refuses an email without @", () => {
    expect(() =>
      User.create({ id: ID, name: "Ada", email: "ada.example.com" }),
    ).toThrow(InvalidUserError);
  });
});
