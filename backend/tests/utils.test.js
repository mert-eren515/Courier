import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateToken } from "../src/lib/utils.js";

const USER_ID = "507f1f77bcf86cd799439011";
const SECRET = "test-secret";
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

describe("generateToken", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  // Calls generateToken with a fake response object and unpacks the single
  // res.cookie(...) call it makes.
  const generate = () => {
    const res = { cookie: vi.fn() };
    const token = generateToken(USER_ID, res);
    const [name, value, options] = res.cookie.mock.calls[0];

    return { token, name, value, options };
  };

  it("signs a token that carries the user id", () => {
    const { token } = generate();

    expect(jwt.verify(token, SECRET).userId).toBe(USER_ID);
  });

  it("expires the token after seven days", () => {
    const { token } = generate();
    const { iat, exp } = jwt.verify(token, SECRET);

    expect(exp - iat).toBe(SEVEN_DAYS_IN_SECONDS);
  });

  it("sends the token back as the jwt cookie", () => {
    const { token, name, value } = generate();

    expect(name).toBe("jwt");
    expect(value).toBe(token);
  });

  it("hardens the cookie against xss and csrf", () => {
    const { options } = generate();

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.maxAge).toBe(SEVEN_DAYS_IN_SECONDS * 1000);
  });

  it("allows the cookie over plain http in development", () => {
    process.env.NODE_ENV = "development";

    expect(generate().options.secure).toBe(false);
  });

  it("requires https for the cookie outside development", () => {
    process.env.NODE_ENV = "production";

    expect(generate().options.secure).toBe(true);
  });

  it("rejects a token signed with a different secret", () => {
    const { token } = generate();

    expect(() => jwt.verify(token, "another-secret")).toThrow();
  });
});
