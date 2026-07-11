import { afterEach, beforeAll, describe, expect, it } from "vitest";

// Integration tests del visor de logs (PR-14). Necesitan Redis real —
// el hook de logger.ts escribe ahí y admin/service.ts lee de ahí.
const hasRedis = Boolean(process.env.REDIS_URL);

describe.skipIf(!hasRedis)("error log buffer (integration)", () => {
  let logger: typeof import("@/lib/logger");
  let admin: typeof import("./service");
  let redis: import("ioredis").Redis;

  beforeAll(async () => {
    logger = await import("@/lib/logger");
    admin = await import("./service");
    const { getRedis } = await import("@/lib/redis");
    redis = getRedis();
  });

  afterEach(async () => {
    await redis.del(logger.LOG_BUFFER_KEY);
  });

  it("caps the buffer at LOG_BUFFER_MAX entries, newest first", async () => {
    const max = Number(process.env.LOG_BUFFER_MAX ?? 500);
    // El push es fire-and-forget, pero todas las llamadas viajan por la misma
    // conexión ioredis (singleton), que preserva el orden de despacho aunque
    // no se esperen las promesas individuales — no hace falta await por push.
    for (let i = 0; i < max + 50; i++) {
      logger.logger.error(`err-${i}`, new Error(`boom-${i}`));
    }
    // Margen para que los últimos pushes (async) se asienten.
    await new Promise((r) => setTimeout(r, 500));

    const len = await redis.llen(logger.LOG_BUFFER_KEY);
    expect(len).toBe(max);

    const entries = await admin.getErrorLogs();
    expect(entries).toHaveLength(max);
    // El más reciente (último insertado) queda primero.
    expect(entries[0].msg).toBe(`err-${max + 49}`);
  }, 20_000);

  it("captures both a server error and a client_error report with route/digest", async () => {
    logger.logger.error("server_boom", new Error("Invalid time value"), {
      route: "/clientes",
      partnerId: "11111111-1111-1111-1111-111111111111",
    });
    logger.logger.error("client_error", "stack text", {
      source: "client",
      boundary: "app-error",
      digest: "4159151474",
      route: "/clientes",
    });
    await new Promise((r) => setTimeout(r, 50));

    const entries = await admin.getErrorLogs();
    const server = entries.find((e) => e.msg === "server_boom");
    const client = entries.find((e) => e.msg === "client_error");
    expect(server?.route).toBe("/clientes");
    expect(server?.errMessage).toBe("Invalid time value");
    expect(client?.source).toBe("client");
    expect(client?.digest).toBe("4159151474");
  });

  it("clearErrorLogs empties the buffer", async () => {
    logger.logger.error("to be cleared", new Error("x"));
    await new Promise((r) => setTimeout(r, 50));
    expect((await admin.getErrorLogs()).length).toBeGreaterThan(0);

    await admin.clearErrorLogs();
    expect(await admin.getErrorLogs()).toEqual([]);
  });

  it("a corrupted entry renders as raw instead of crashing the read", async () => {
    await redis.lpush(logger.LOG_BUFFER_KEY, "{not valid json");
    const entries = await admin.getErrorLogs();
    expect(entries).toHaveLength(1);
    expect(entries[0].raw).toBe("{not valid json");
    expect(entries[0].msg).toBe("(entrada corrupta)");
  });
});
