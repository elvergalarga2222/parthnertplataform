import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El hook de buffer nunca puede lanzar ni bloquear al caller — cubrimos los
// dos caminos de fallo (sin REDIS_URL, y con Redis que rechaza) y el
// truncado de campos largos, sin necesidad de un Redis real.

describe("logger buffer safety", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
  });

  it("logger.error never throws without REDIS_URL", async () => {
    delete process.env.REDIS_URL;
    const { logger } = await import("./logger");
    expect(() => logger.error("boom", new Error("x"))).not.toThrow();
  });

  it("logger.error never throws when the Redis push rejects", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    vi.doMock("./redis", () => ({
      getRedis: () => ({
        multi: () => ({
          lpush: () => ({
            ltrim: () => ({
              expire: () => ({
                exec: () => Promise.reject(new Error("redis down")),
              }),
            }),
          }),
        }),
      }),
    }));
    const { logger } = await import("./logger");
    expect(() => logger.error("boom", new Error("x"))).not.toThrow();
  });

  it("logger.error never throws when getRedis() itself throws", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    vi.doMock("./redis", () => ({
      getRedis: () => {
        throw new Error("cannot connect");
      },
    }));
    const { logger } = await import("./logger");
    expect(() => logger.error("boom", new Error("x"))).not.toThrow();
  });

  it("does not push to the buffer for warn/info/debug", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const exec = vi.fn(() => Promise.resolve());
    const ltrim = vi.fn(() => ({ expire: () => ({ exec }) }));
    const lpush = vi.fn(() => ({ ltrim }));
    vi.doMock("./redis", () => ({
      getRedis: () => ({ multi: () => ({ lpush }) }),
    }));
    const { logger } = await import("./logger");
    logger.warn("not an error");
    logger.info("also not");
    expect(lpush).not.toHaveBeenCalled();
  });
});

describe("clipRecord", () => {
  it("truncates long stacks and messages, leaves short ones untouched", async () => {
    const { clipRecord } = await import("./logger");
    const longStack = "x".repeat(5000);
    const longMsg = "y".repeat(3000);
    const clipped = clipRecord({
      msg: longMsg,
      err: { name: "Error", message: longMsg, stack: longStack },
    });
    expect((clipped.msg as string).length).toBe(2000);
    const err = clipped.err as { message: string; stack: string };
    expect(err.message.length).toBe(2000);
    expect(err.stack.length).toBe(4000);
  });

  it("leaves records without err or short fields unchanged", async () => {
    const { clipRecord } = await import("./logger");
    const record = { msg: "short", route: "/clientes" };
    expect(clipRecord(record)).toEqual(record);
  });
});
