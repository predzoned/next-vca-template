import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";

const { createUser, listUsers } = vi.hoisted(() => ({
  createUser: vi.fn(),
  listUsers: vi.fn(),
}));

vi.mock("@/features/users/server", () => ({ createUser, listUsers }));

function postJson(body: unknown): Request {
  return new Request("http://localhost/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/users", () => {
  it("returns the users from the slice", async () => {
    listUsers.mockResolvedValue([
      { id: "1", name: "Ada", email: "ada@example.com" },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: "1", name: "Ada", email: "ada@example.com" },
    ]);
  });
});

describe("POST /api/users", () => {
  it("rejects invalid input with 400 before calling the slice", async () => {
    const response = await POST(postJson({ name: "", email: "nope" }));

    expect(response.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 201 with the created user", async () => {
    const user = { id: "1", name: "Ada", email: "ada@example.com" };
    createUser.mockResolvedValue({ ok: true, user });

    const response = await POST(
      postJson({ name: "Ada", email: "ada@example.com" }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, user });
  });

  it("returns 409 when the email is taken", async () => {
    createUser.mockResolvedValue({ ok: false, error: "duplicate-email" });

    const response = await POST(
      postJson({ name: "Ada", email: "ada@example.com" }),
    );

    expect(response.status).toBe(409);
  });
});
