import { describe, expect, it } from "vitest";
import { User } from "../../../domain/User";
import type { UserId } from "../../../domain/UserId";
import { InMemoryUserRepository } from "../InMemoryUserRepository";

const ada = User.create({
  id: "user-1" as UserId,
  name: "Ada",
  email: "ada@example.com",
});

describe("InMemoryUserRepository", () => {
  it("finds a saved user by id and by email", async () => {
    const repository = new InMemoryUserRepository();
    await repository.save(ada);

    expect(await repository.findById(ada.id)).toBe(ada);
    expect(await repository.findByEmail("ada@example.com")).toBe(ada);
    expect(await repository.findAll()).toEqual([ada]);
  });

  it("returns null for unknown users", async () => {
    const repository = new InMemoryUserRepository();

    expect(await repository.findById("nope" as UserId)).toBeNull();
    expect(await repository.findByEmail("nope@example.com")).toBeNull();
  });
});
