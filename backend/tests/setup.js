import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll } from "vitest";

/**
 * Boots a throwaway in-memory MongoDB for the calling test file, so integration
 * tests never reach the real cluster. The database is dropped after every test,
 * which keeps each case independent of the ones before it.
 */
export function useTestDatabase() {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
}
