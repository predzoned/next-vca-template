import { describe, expect, it } from "vitest";
import { createUserInputSchema, userDtoSchema } from "../user-dto";

describe("createUserInputSchema", () => {
  it("trims the name and accepts a valid email", () => {
    const parsed = createUserInputSchema.parse({
      name: "  Ada  ",
      email: "ada@example.com",
    });

    expect(parsed).toEqual({ name: "Ada", email: "ada@example.com" });
  });

  it("rejects an empty name or a malformed email", () => {
    expect(
      createUserInputSchema.safeParse({ name: " ", email: "ada@example.com" })
        .success,
    ).toBe(false);
    expect(
      createUserInputSchema.safeParse({ name: "Ada", email: "not-an-email" })
        .success,
    ).toBe(false);
  });
});

describe("userDtoSchema", () => {
  it("requires an id", () => {
    expect(
      userDtoSchema.safeParse({ id: "", name: "Ada", email: "ada@example.com" })
        .success,
    ).toBe(false);
  });
});
