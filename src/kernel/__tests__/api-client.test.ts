import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../api-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient", () => {
  it("posts JSON and returns the parsed body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.post("/api/things", { name: "x" });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/things",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "x" }),
      }),
    );
  });

  it("throws ApiError with the status on a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 500 })),
    );

    await expect(apiClient.get("/api/things")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
    });
    await expect(apiClient.get("/api/things")).rejects.toBeInstanceOf(ApiError);
  });
});
