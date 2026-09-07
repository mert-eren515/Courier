import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const { UPLOADED_IMAGE_URL } = vi.hoisted(() => ({
  UPLOADED_IMAGE_URL: "https://cdn.example.com/avatar.png",
}));

// Keep the tests offline: no image ever reaches Cloudinary.
vi.mock("../src/lib/cloudinary.js", () => ({
  default: {
    uploader: {
      upload: vi.fn().mockResolvedValue({ secure_url: UPLOADED_IMAGE_URL }),
    },
  },
}));

const { app } = await import("../src/app.js");
const { default: User } = await import("../src/models/user.model.js");
const { useTestDatabase } = await import("./setup.js");

useTestDatabase();

const credentials = {
  fullName: "Test User",
  email: "test@example.com",
  password: "secret123",
};

const signup = (overrides = {}) =>
  request(app)
    .post("/api/auth/signup")
    .send({ ...credentials, ...overrides });

const login = (body) => request(app).post("/api/auth/login").send(body);

// Registers a user and hands back the auth cookie the server issued.
const registerAndGetCookie = async () => {
  const res = await signup();

  return res.headers["set-cookie"];
};

describe("POST /api/auth/signup", () => {
  it("creates the user and returns the profile without the password", async () => {
    const res = await signup();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fullName: credentials.fullName,
      email: credentials.email,
      profilePic: "",
    });
    expect(res.body.password).toBeUndefined();
  });

  it("issues an auth cookie", async () => {
    const res = await signup();

    expect(res.headers["set-cookie"].join(";")).toContain("jwt=");
  });

  it("stores the password as a hash", async () => {
    await signup();

    const user = await User.findOne({ email: credentials.email });

    expect(user.password).not.toBe(credentials.password);
    expect(await bcrypt.compare(credentials.password, user.password)).toBe(true);
  });

  it("rejects a request with missing fields", async () => {
    const res = await request(app).post("/api/auth/signup").send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("All fields are required");
  });

  it("rejects a password shorter than six characters", async () => {
    const res = await signup({ password: "12345" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Password must be at least 6 characters");
  });

  it("rejects an email that is already registered", async () => {
    await signup();

    const res = await signup({ fullName: "Someone Else" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email already exists");
  });

  it("stores a single user when the same email is submitted twice", async () => {
    await signup();
    await signup();

    expect(await User.countDocuments({ email: credentials.email })).toBe(1);
  });
});

describe("POST /api/auth/login", () => {
  it("returns the user for valid credentials", async () => {
    await signup();

    const res = await login({
      email: credentials.email,
      password: credentials.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(credentials.email);
    expect(res.headers["set-cookie"].join(";")).toContain("jwt=");
  });

  // Regression test: an empty body used to reach Mongoose as findOne({}), which
  // matched an arbitrary existing user and then crashed inside bcrypt.compare.
  it("rejects an empty body instead of matching an arbitrary user", async () => {
    await signup();

    const res = await login({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("All fields are required");
  });

  it("rejects a request that omits the password", async () => {
    await signup();

    const res = await login({ email: credentials.email });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("All fields are required");
  });

  it("rejects a wrong password", async () => {
    await signup();

    const res = await login({
      email: credentials.email,
      password: "wrong-password",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("rejects an unknown email", async () => {
    const res = await login({
      email: "nobody@example.com",
      password: credentials.password,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid credentials");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the auth cookie", async () => {
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"].join(";")).toContain("jwt=;");
  });
});

describe("GET /api/auth/check", () => {
  it("returns the current user for a valid cookie", async () => {
    const cookie = await registerAndGetCookie();

    const res = await request(app).get("/api/auth/check").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(credentials.email);
    expect(res.body.password).toBeUndefined();
  });

  it("rejects a request without a cookie", async () => {
    const res = await request(app).get("/api/auth/check");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized - No Token Provided");
  });

  it("rejects a malformed token", async () => {
    const res = await request(app)
      .get("/api/auth/check")
      .set("Cookie", ["jwt=not-a-real-token"]);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized - Invalid Token");
  });

  // Every session reaches this state after seven days, so it has to read as an
  // expected outcome rather than a server failure.
  it("rejects an expired token", async () => {
    const expired = jwt.sign(
      { userId: "507f1f77bcf86cd799439011" },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" },
    );

    const res = await request(app)
      .get("/api/auth/check")
      .set("Cookie", [`jwt=${expired}`]);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized - Invalid Token");
  });

  it("rejects a token signed with a different secret", async () => {
    const foreign = jwt.sign(
      { userId: "507f1f77bcf86cd799439011" },
      "some-other-secret",
    );

    const res = await request(app)
      .get("/api/auth/check")
      .set("Cookie", [`jwt=${foreign}`]);

    expect(res.status).toBe(401);
  });
});

describe("PUT /api/auth/update-profile", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .put("/api/auth/update-profile")
      .send({ profilePic: "data:image/png;base64,abc" });

    expect(res.status).toBe(401);
  });

  it("rejects a request without a picture", async () => {
    const cookie = await registerAndGetCookie();

    const res = await request(app)
      .put("/api/auth/update-profile")
      .set("Cookie", cookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Profile pic is required");
  });

  it("saves the uploaded picture url on the user", async () => {
    const cookie = await registerAndGetCookie();

    const res = await request(app)
      .put("/api/auth/update-profile")
      .set("Cookie", cookie)
      .send({ profilePic: "data:image/png;base64,abc" });

    expect(res.status).toBe(200);
    expect(res.body.profilePic).toBe(UPLOADED_IMAGE_URL);

    const user = await User.findOne({ email: credentials.email });
    expect(user.profilePic).toBe(UPLOADED_IMAGE_URL);
  });
});
