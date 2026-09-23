import { beforeEach, describe, expect, it } from "vitest";
import { DuplicateEmailError } from "../../domain/errors";
import { InMemoryIdGenerator } from "../../infra/in-memory/InMemoryIdGenerator";
import { InMemoryUserRepository } from "../../infra/in-memory/InMemoryUserRepository";
import { UsersService } from "../UsersService";

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService(
      new InMemoryUserRepository(),
      new InMemoryIdGenerator(),
    );
  });

  it("creates a user and lists it", async () => {
    const created = await service.create({
      name: "Ada",
      email: "ada@example.com",
    });

    expect(created.id).toBe("user-1");
    expect(await service.list()).toEqual([created]);
    expect(await service.getById(created.id)).toBe(created);
  });

  it("refuses a second user with the same email, ignoring case", async () => {
    await service.create({ name: "Ada", email: "ada@example.com" });

    await expect(
      service.create({ name: "Other Ada", email: "ADA@example.com" }),
    ).rejects.toBeInstanceOf(DuplicateEmailError);
  });
});
