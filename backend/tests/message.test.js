import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const { UPLOADED_IMAGE_URL } = vi.hoisted(() => ({
  UPLOADED_IMAGE_URL: "https://cdn.example.com/message.png",
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
const { default: Friendship } = await import(
  "../src/models/friendship.model.js"
);
const { useTestDatabase } = await import("./setup.js");

useTestDatabase();

// Registers a user and returns the id plus the auth cookie for that session.
const registerUser = async (name) => {
  const res = await request(app).post("/api/auth/signup").send({
    fullName: name,
    username: name.toLowerCase(),
    email: `${name.toLowerCase()}@example.com`,
    password: "secret123",
  });

  return { id: res.body._id, cookie: res.headers["set-cookie"] };
};

// Messaging requires an accepted friendship, so most cases start from one.
const makeFriends = (a, b) =>
  Friendship.create({
    requester: a.id,
    recipient: b.id,
    status: "accepted",
    acceptedAt: new Date(),
  });

const sendMessage = (sender, receiverId, body) =>
  request(app)
    .post(`/api/messages/send/${receiverId}`)
    .set("Cookie", sender.cookie)
    .send(body);

describe("POST /api/messages/send/:id", () => {
  it("stores a text message between friends", async () => {
    const alice = await registerUser("Alice");
    const bob = await registerUser("Bob");
    await makeFriends(alice, bob);

    const res = await sendMessage(alice, bob.id, { text: "hello" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      text: "hello",
      senderId: alice.id,
      receiverId: bob.id,
    });
  });

  it("uploads an attached image and stores the returned url", async () => {
    const alice = await registerUser("Alice");
    const bob = await registerUser("Bob");
    await makeFriends(alice, bob);

    const res = await sendMessage(alice, bob.id, {
      image: "data:image/png;base64,abc",
    });

    expect(res.status).toBe(201);
    expect(res.body.image).toBe(UPLOADED_IMAGE_URL);
  });

  it("refuses to message someone who is not a friend", async () => {
    const alice = await registerUser("Alice");
    const bob = await registerUser("Bob");

    const res = await sendMessage(alice, bob.id, { text: "hello" });

    expect(res.status).toBe(403);
  });

  it("refuses to message someone with only a pending request", async () => {
    const alice = await registerUser("Alice");
    const bob = await registerUser("Bob");
    await Friendship.create({ requester: alice.id, recipient: bob.id });

    const res = await sendMessage(alice, bob.id, { text: "hello" });

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated senders", async () => {
    const bob = await registerUser("Bob");

    const res = await request(app)
      .post(`/api/messages/send/${bob.id}`)
      .send({ text: "hello" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/messages/:id", () => {
  it("returns the conversation in both directions", async () => {
    const alice = await registerUser("Alice");
    const bob = await registerUser("Bob");
    await makeFriends(alice, bob);

    await sendMessage(alice, bob.id, { text: "from alice" });
    await sendMessage(bob, alice.id, { text: "from bob" });

    const res = await request(app)
      .get(`/api/messages/${bob.id}`)
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body.map((message) => message.text)).toEqual([
      "from alice",
      "from bob",
    ]);
  });

  it("leaves out messages belonging to other conversations", async () => {
    const alice = await registerUser("Alice");
    const bob = await registerUser("Bob");
    const carol = await registerUser("Carol");
    await makeFriends(alice, bob);
    await makeFriends(alice, carol);

    await sendMessage(alice, bob.id, { text: "for bob" });
    await sendMessage(alice, carol.id, { text: "for carol" });

    const res = await request(app)
      .get(`/api/messages/${bob.id}`)
      .set("Cookie", alice.cookie);

    expect(res.body.map((message) => message.text)).toEqual(["for bob"]);
  });

  it("refuses to read a conversation with a non-friend", async () => {
    const alice = await registerUser("Alice");
    const bob = await registerUser("Bob");

    const res = await request(app)
      .get(`/api/messages/${bob.id}`)
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests", async () => {
    const bob = await registerUser("Bob");

    const res = await request(app).get(`/api/messages/${bob.id}`);

    expect(res.status).toBe(401);
  });
});
