import { describe, expect, it, vi } from "vitest";
import { createUserAction } from "../actions";

const { createUser } = vi.hoisted(() => ({ createUser: vi.fn() }));

vi.mock("../server", () => ({ createUser }));

describe("createUserAction", () => {
  it("rejects invalid input before calling the slice", async () => {
    await expect(
      createUserAction({ name: "", email: "nope" }),
    ).rejects.toThrow();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns the slice's result for valid input", async () => {
    const user = { id: "1", name: "Ada", email: "ada@example.com" };
    createUser.mockResolvedValue({ ok: true, user });

    const result = await createUserAction({
      name: "Ada",
      email: "ada@example.com",
    });

    expect(result).toEqual({ ok: true, user });
    expect(createUser).toHaveBeenCalledWith({
      name: "Ada",
      email: "ada@example.com",
    });
  });
});
