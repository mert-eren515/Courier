import request from "supertest";
import { describe, expect, it } from "vitest";

const { app } = await import("../src/app.js");
const { default: Friendship } = await import(
  "../src/models/friendship.model.js"
);
const { default: User } = await import("../src/models/user.model.js");
const { useTestDatabase } = await import("./setup.js");

useTestDatabase();

const registerUser = async (username) => {
  const res = await request(app).post("/api/auth/signup").send({
    fullName: username,
    username,
    email: `${username.toLowerCase()}@example.com`,
    password: "secret123",
  });

  return { id: res.body._id, username, cookie: res.headers["set-cookie"] };
};

const seedUser = (username) =>
  User.create({
    fullName: username,
    username,
    email: `${username}@example.com`,
    password: "not-used-in-these-tests",
  });

const asUser = (user) => ({
  get: (url) => request(app).get(url).set("Cookie", user.cookie),
  post: (url, body) =>
    request(app).post(url).set("Cookie", user.cookie).send(body ?? {}),
  del: (url) => request(app).delete(url).set("Cookie", user.cookie),
});

const makeFriends = (a, b) =>
  Friendship.create({
    requester: a.id,
    recipient: b.id,
    status: "accepted",
    acceptedAt: new Date(),
  });

describe("POST /api/friends/requests", () => {
  it("creates a pending request", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const res = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe("bob");
  });

  it("rejects an unknown username", async () => {
    const alice = await registerUser("alice");

    const res = await asUser(alice).post("/api/friends/requests", {
      username: "nobody",
    });

    expect(res.status).toBe(404);
  });

  it("refuses a request to yourself", async () => {
    const alice = await registerUser("alice");

    const res = await asUser(alice).post("/api/friends/requests", {
      username: alice.username,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("You cannot add yourself as a friend");
  });

  it("refuses a second request to the same person", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });
    const res = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("There is already a pending request");
  });

  it("refuses a request when the pair is already connected the other way", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await asUser(bob).post("/api/friends/requests", {
      username: alice.username,
    });
    const res = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    expect(res.status).toBe(400);
  });

  it("refuses a request to someone you blocked", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await asUser(alice).post(`/api/friends/block/${bob.id}`);
    const res = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    expect(res.status).toBe(400);
  });

  // Answering with a block notice would leak the recipient decision.
  it("hides that the recipient blocked you", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await asUser(bob).post(`/api/friends/block/${alice.id}`);
    const res = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User not found");
  });
});

describe("POST /api/friends/requests/:id/accept", () => {
  it("turns the request into a friendship for both sides", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const sent = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    const res = await asUser(bob).post(
      `/api/friends/requests/${sent.body._id}/accept`,
    );

    expect(res.status).toBe(200);

    const aliceFriends = await asUser(alice).get("/api/friends");
    const bobFriends = await asUser(bob).get("/api/friends");

    expect(aliceFriends.body.map((user) => user.username)).toEqual(["bob"]);
    expect(bobFriends.body.map((user) => user.username)).toEqual(["alice"]);
  });

  it("refuses to let the sender accept their own request", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const sent = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    const res = await asUser(alice).post(
      `/api/friends/requests/${sent.body._id}/accept`,
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 for a malformed id instead of failing", async () => {
    const alice = await registerUser("alice");

    const res = await asUser(alice).post(
      "/api/friends/requests/not-an-id/accept",
    );

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/friends/requests/:id", () => {
  it("lets the recipient decline", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const sent = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    const res = await asUser(bob).del(`/api/friends/requests/${sent.body._id}`);

    expect(res.status).toBe(200);
    expect(await Friendship.countDocuments()).toBe(0);
  });

  it("lets the sender cancel", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const sent = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    const res = await asUser(alice).del(
      `/api/friends/requests/${sent.body._id}`,
    );

    expect(res.status).toBe(200);
  });

  it("does not let an unrelated user remove the request", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const carol = await registerUser("carol");

    const sent = await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    const res = await asUser(carol).del(
      `/api/friends/requests/${sent.body._id}`,
    );

    expect(res.status).toBe(404);
    expect(await Friendship.countDocuments()).toBe(1);
  });
});

describe("GET /api/friends/requests", () => {
  it("lists incoming requests newest first", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const carol = await registerUser("carol");

    await asUser(bob).post("/api/friends/requests", {
      username: alice.username,
    });
    await asUser(carol).post("/api/friends/requests", {
      username: alice.username,
    });

    const res = await asUser(alice).get("/api/friends/requests/incoming");

    expect(res.status).toBe(200);
    expect(res.body.map((row) => row.user.username)).toEqual(["carol", "bob"]);
  });

  it("keeps incoming and outgoing apart", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });

    const incoming = await asUser(alice).get("/api/friends/requests/incoming");
    const outgoing = await asUser(alice).get("/api/friends/requests/outgoing");

    expect(incoming.body).toEqual([]);
    expect(outgoing.body.items.map((row) => row.user.username)).toEqual(["bob"]);
  });

  it("pages outgoing requests twenty at a time", async () => {
    const alice = await registerUser("alice");

    for (let i = 0; i < 25; i += 1) {
      const target = await seedUser(`user${String(i).padStart(2, "0")}`);
      await asUser(alice).post("/api/friends/requests", {
        username: target.username,
      });
    }

    const first = await asUser(alice).get("/api/friends/requests/outgoing");
    const second = await asUser(alice).get(
      "/api/friends/requests/outgoing?page=2",
    );

    expect(first.body.total).toBe(25);
    expect(first.body.items).toHaveLength(20);
    expect(second.body.items).toHaveLength(5);
    expect(second.body.page).toBe(2);
  });
});

describe("GET /api/friends/search", () => {
  it("returns an empty list when the term is blank", async () => {
    const alice = await registerUser("alice");
    await registerUser("bob");

    const res = await asUser(alice).get("/api/friends/search?q=");

    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("matches usernames case insensitively", async () => {
    const alice = await registerUser("alice");
    await registerUser("BobSmith");

    const res = await asUser(alice).get("/api/friends/search?q=bobsm");

    expect(res.body.items.map((user) => user.username)).toEqual(["BobSmith"]);
  });

  it("never returns the person searching", async () => {
    const alice = await registerUser("alice");

    const res = await asUser(alice).get("/api/friends/search?q=alice");

    expect(res.body.items).toEqual([]);
  });

  it("reports the relationship for each result", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("peer_bob");
    const carol = await registerUser("peer_carol");
    const dave = await registerUser("peer_dave");
    await registerUser("peer_erin");

    await asUser(alice).post("/api/friends/requests", {
      username: bob.username,
    });
    await asUser(carol).post("/api/friends/requests", {
      username: alice.username,
    });
    await makeFriends(alice, dave);

    const res = await asUser(alice).get("/api/friends/search?q=peer");
    const byName = Object.fromEntries(
      res.body.items.map((user) => [user.username, user.relation]),
    );

    expect(byName.peer_bob).toBe("outgoing");
    expect(byName.peer_carol).toBe("incoming");
    expect(byName.peer_dave).toBe("friends");
    expect(byName.peer_erin).toBe("none");
  });

  it("hides users in either direction of a block", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const carol = await registerUser("carol");

    await asUser(alice).post(`/api/friends/block/${bob.id}`);
    await asUser(carol).post(`/api/friends/block/${alice.id}`);

    const res = await asUser(alice).get("/api/friends/search?q=o");

    expect(res.body.items.map((user) => user.username)).toEqual([]);
  });

  it("treats regex characters in the term as plain text", async () => {
    const alice = await registerUser("alice");
    await registerUser("bob");

    const res = await asUser(alice).get("/api/friends/search?q=.*");

    expect(res.body.items).toEqual([]);
  });

  it("pages results twenty at a time", async () => {
    const alice = await registerUser("alice");

    for (let i = 0; i < 23; i += 1) {
      await seedUser(`finder${String(i).padStart(2, "0")}`);
    }

    const first = await asUser(alice).get("/api/friends/search?q=finder");
    const second = await asUser(alice).get(
      "/api/friends/search?q=finder&page=2",
    );

    expect(first.body.total).toBe(23);
    expect(first.body.items).toHaveLength(20);
    expect(second.body.items).toHaveLength(3);
  });
});

describe("DELETE /api/friends/:id", () => {
  it("removes the friendship for both sides", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    await makeFriends(alice, bob);

    const res = await asUser(alice).del(`/api/friends/${bob.id}`);

    expect(res.status).toBe(200);
    expect((await asUser(bob).get("/api/friends")).body).toEqual([]);
  });

  it("returns 404 when there is no friendship", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const res = await asUser(alice).del(`/api/friends/${bob.id}`);

    expect(res.status).toBe(404);
  });
});

describe("blocking", () => {
  it("ends an existing friendship", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    await makeFriends(alice, bob);

    await asUser(alice).post(`/api/friends/block/${bob.id}`);

    expect((await asUser(alice).get("/api/friends")).body).toEqual([]);
    expect((await asUser(bob).get("/api/friends")).body).toEqual([]);
  });

  it("drops a pending request in either direction", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await asUser(bob).post("/api/friends/requests", {
      username: alice.username,
    });
    await asUser(alice).post(`/api/friends/block/${bob.id}`);

    expect(await Friendship.countDocuments()).toBe(0);
  });

  it("lists blocked users and lets them be unblocked", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await asUser(alice).post(`/api/friends/block/${bob.id}`);
    const blocked = await asUser(alice).get("/api/friends/blocked");

    expect(blocked.body.map((user) => user.username)).toEqual(["bob"]);

    await asUser(alice).del(`/api/friends/block/${bob.id}`);
    const after = await asUser(alice).get("/api/friends/blocked");

    expect(after.body).toEqual([]);
  });

  it("refuses to block yourself", async () => {
    const alice = await registerUser("alice");

    const res = await asUser(alice).post(`/api/friends/block/${alice.id}`);

    expect(res.status).toBe(400);
  });

  it("does not duplicate an entry when blocking twice", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await asUser(alice).post(`/api/friends/block/${bob.id}`);
    await asUser(alice).post(`/api/friends/block/${bob.id}`);

    const me = await User.findById(alice.id);

    expect(me.blocked).toHaveLength(1);
  });
});

describe("friend endpoints without a session", () => {
  it("reject every route", async () => {
    const routes = [
      request(app).get("/api/friends"),
      request(app).get("/api/friends/search?q=a"),
      request(app).get("/api/friends/blocked"),
      request(app).get("/api/friends/requests/incoming"),
      request(app).get("/api/friends/requests/outgoing"),
      request(app).post("/api/friends/requests").send({ username: "bob" }),
    ];

    for (const route of routes) {
      expect((await route).status).toBe(401);
    }
  });
});
