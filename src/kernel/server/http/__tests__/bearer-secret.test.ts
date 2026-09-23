import { describe, expect, it } from "vitest";
import { isAuthorizedBySecret } from "../bearer-secret";

function requestWithAuthorization(value?: string): Request {
  const headers = value ? { authorization: value } : undefined;
  return new Request("https://example.com/api/cron/job", { headers });
}

describe("isAuthorizedBySecret", () => {
  it("accepts the matching bearer secret", () => {
    const request = requestWithAuthorization("Bearer s3cret");
    expect(isAuthorizedBySecret(request, "s3cret")).toBe(true);
  });

  it("rejects a wrong secret", () => {
    const request = requestWithAuthorization("Bearer wrong");
    expect(isAuthorizedBySecret(request, "s3cret")).toBe(false);
  });

  it("rejects a missing or non-bearer header", () => {
    expect(isAuthorizedBySecret(requestWithAuthorization(), "s3cret")).toBe(
      false,
    );
    expect(
      isAuthorizedBySecret(requestWithAuthorization("Basic s3cret"), "s3cret"),
    ).toBe(false);
  });

  it("rejects everything when the secret is not configured", () => {
    const request = requestWithAuthorization("Bearer ");
    expect(isAuthorizedBySecret(request, undefined)).toBe(false);
    expect(isAuthorizedBySecret(request, "")).toBe(false);
  });
});
