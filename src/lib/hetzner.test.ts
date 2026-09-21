import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createServer,
  getLocationPreference,
  HetznerApiError,
  HetznerNoCapacityError,
} from "./hetzner";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createdResponse(id: number, actionStatus = "success") {
  return jsonResponse(201, {
    server: {
      id,
      name: "srv",
      status: "initializing",
      public_net: { ipv4: { ip: "1.2.3.4" }, ipv6: { ip: "" } },
      server_type: { name: "cx23", description: "CX23" },
      created: "2026-09-16T00:00:00Z",
    },
    action: { id: 99, status: actionStatus },
  });
}

function actionResponse(
  status: "running" | "success" | "error",
  error: { code: string; message: string } | null = null,
) {
  return jsonResponse(200, {
    action: { id: 99, command: "create_server", status, progress: 100, error },
  });
}

function deletedResponse() {
  return jsonResponse(200, { action: { id: 100, command: "delete_server", status: "running" } });
}

function deleteCalls(fetchMock: FetchMock) {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit)?.method === "DELETE")
    .map(([url]) => String(url));
}

function outOfStockResponse() {
  return jsonResponse(412, {
    error: {
      code: "resource_unavailable",
      message:
        "we are unable to provision servers for this location, try with a different location or try later",
      details: null,
    },
  });
}

function postCalls(fetchMock: FetchMock) {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit)?.method === "POST")
    .map(([url, init]) => ({
      url: String(url),
      body: JSON.parse(String((init as RequestInit).body)),
    }));
}

function getCalls(fetchMock: FetchMock) {
  return fetchMock.mock.calls
    .filter(([, init]) => !(init as RequestInit)?.method)
    .map(([url]) => String(url));
}

describe("getLocationPreference", () => {
  const original = process.env.HETZNER_LOCATIONS;
  afterEach(() => {
    if (original === undefined) delete process.env.HETZNER_LOCATIONS;
    else process.env.HETZNER_LOCATIONS = original;
  });

  it("defaults to hel1, nbg1, fsn1 in that order", () => {
    delete process.env.HETZNER_LOCATIONS;
    expect(getLocationPreference()).toEqual(["hel1", "nbg1", "fsn1"]);
  });

  it("reads HETZNER_LOCATIONS, trimming entries and dropping empties", () => {
    process.env.HETZNER_LOCATIONS = " nbg1, fsn1,,";
    expect(getLocationPreference()).toEqual(["nbg1", "fsn1"]);
  });
});

describe("createServer location fallback", () => {
  let fetchMock: FetchMock;
  const originalLocations = process.env.HETZNER_LOCATIONS;
  const originalToken = process.env.HETZNER_API_TOKEN;

  beforeEach(() => {
    process.env.HETZNER_API_TOKEN = "test-token";
    delete process.env.HETZNER_LOCATIONS;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalLocations === undefined) delete process.env.HETZNER_LOCATIONS;
    else process.env.HETZNER_LOCATIONS = originalLocations;
    if (originalToken === undefined) delete process.env.HETZNER_API_TOKEN;
    else process.env.HETZNER_API_TOKEN = originalToken;
  });

  it("creates in the first preferred location", async () => {
    fetchMock.mockResolvedValueOnce(createdResponse(10));

    const server = await createServer(
      "srv",
      "#cloud-config",
      ["k"],
      undefined,
      "cx23",
    );

    const posts = postCalls(fetchMock);
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("https://api.hetzner.cloud/v1/servers");
    expect(posts[0].body.location).toBe("hel1");
    expect(posts[0].body.server_type).toBe("cx23");
    expect(server.id).toBe(10);
    expect(server.location).toBe("hel1");
  });

  it("never calls GET /server_types on the create path (2026-09-21: the available flag gated every provision off while POST succeeded)", async () => {
    fetchMock
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(createdResponse(15));

    const server = await createServer("srv", "#cloud-config");

    expect(getCalls(fetchMock).filter((u) => u.includes("/server_types"))).toEqual([]);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).toBe("https://api.hetzner.cloud/v1/servers");
      expect((init as RequestInit).method).toBe("POST");
    }
    expect(postCalls(fetchMock).map((p) => p.body.location)).toEqual([
      "hel1",
      "nbg1",
    ]);
    expect(server.location).toBe("nbg1");
  });

  it("passes ssh_keys only when provided", async () => {
    fetchMock
      .mockResolvedValueOnce(createdResponse(20))
      .mockResolvedValueOnce(createdResponse(21));

    await createServer("srv", "#cloud-config", ["key-a", "key-b"]);
    await createServer("srv", "#cloud-config");

    const posts = postCalls(fetchMock);
    expect(posts[0].body.ssh_keys).toEqual(["key-a", "key-b"]);
    expect(posts[1].body.ssh_keys).toBeUndefined();
  });

  it("uses the requested server type and image, defaulting the image to ubuntu-24.04", async () => {
    fetchMock
      .mockResolvedValueOnce(createdResponse(22))
      .mockResolvedValueOnce(createdResponse(23));

    await createServer("srv", "#cloud-config", undefined, "12345", "cx33");
    await createServer("srv", "#cloud-config");

    const posts = postCalls(fetchMock);
    expect(posts[0].body.server_type).toBe("cx33");
    expect(posts[0].body.image).toBe("12345");
    expect(posts[1].body.server_type).toBe("cx23");
    expect(posts[1].body.image).toBe("ubuntu-24.04");
  });

  it("falls back to the next location when POST /servers returns resource_unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(createdResponse(11));

    const server = await createServer("srv", "#cloud-config");

    const posts = postCalls(fetchMock);
    expect(posts.map((p) => p.body.location)).toEqual(["hel1", "nbg1"]);
    expect(server.id).toBe(11);
    expect(server.location).toBe("nbg1");
  });

  it("rethrows non-stock errors without trying other locations", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: { code: "invalid_input", message: "bad name", details: null },
      }),
    );

    await expect(createServer("srv", "#cloud-config")).rejects.toBeInstanceOf(
      HetznerApiError,
    );
    expect(postCalls(fetchMock)).toHaveLength(1);
  });

  it("throws HetznerNoCapacityError only after every location returns resource_unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(outOfStockResponse());

    const err = await createServer(
      "srv",
      "#cloud-config",
      undefined,
      undefined,
      "cx23",
    ).catch((e) => e);

    expect(err).toBeInstanceOf(HetznerNoCapacityError);
    expect(err.message).toContain("cx23");
    expect(err.message).toContain("hel1, nbg1, fsn1");
    expect(postCalls(fetchMock).map((p) => p.body.location)).toEqual([
      "hel1",
      "nbg1",
      "fsn1",
    ]);
  });

  it("honors HETZNER_LOCATIONS override for the fallback order", async () => {
    process.env.HETZNER_LOCATIONS = "fsn1,hel1";
    fetchMock
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(createdResponse(14));

    const server = await createServer("srv", "#cloud-config");

    expect(postCalls(fetchMock).map((p) => p.body.location)).toEqual([
      "fsn1",
      "hel1",
    ]);
    expect(server.location).toBe("hel1");
  });

  it("keeps the server type fixed across the location walk (location fallback, never type fallback)", async () => {
    fetchMock
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(createdResponse(30));

    await createServer("srv", "#cloud-config", undefined, undefined, "cx33");

    const posts = postCalls(fetchMock);
    expect(posts.map((p) => p.body.location)).toEqual(["hel1", "nbg1", "fsn1"]);
    expect(posts.every((p) => p.body.server_type === "cx33")).toBe(true);
  });

  it("names the overridden HETZNER_LOCATIONS in HetznerNoCapacityError", async () => {
    process.env.HETZNER_LOCATIONS = "fsn1,hel1";
    fetchMock
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(outOfStockResponse());

    const err = await createServer("srv", "#cloud-config").catch((e) => e);

    expect(err).toBeInstanceOf(HetznerNoCapacityError);
    expect(err.message).toContain("fsn1, hel1");
    expect(err.message).not.toContain("nbg1");
    expect(postCalls(fetchMock)).toHaveLength(2);
  });

  it("retries the whole location walk on no-capacity, sleeping between attempts", async () => {
    const sleep = vi.fn(async () => {});
    fetchMock
      .mockResolvedValueOnce(outOfStockResponse()) // attempt 1: hel1
      .mockResolvedValueOnce(outOfStockResponse()) //            nbg1
      .mockResolvedValueOnce(outOfStockResponse()) //            fsn1
      .mockResolvedValueOnce(outOfStockResponse()) // attempt 2: hel1
      .mockResolvedValueOnce(outOfStockResponse()) //            nbg1
      .mockResolvedValueOnce(outOfStockResponse()) //            fsn1
      .mockResolvedValueOnce(createdResponse(77)); // attempt 3: hel1

    const server = await createServer("n", "ud", undefined, undefined, "cx23", {
      maxAttempts: 3,
      retryDelayMs: 20_000,
      sleep,
    });

    expect(server.id).toBe(77);
    expect(server.location).toBe("hel1");
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 20_000);
    expect(postCalls(fetchMock)).toHaveLength(7);
  });

  it("throws HetznerNoCapacityError with code no_capacity after maxAttempts", async () => {
    const sleep = vi.fn(async () => {});
    for (let attempt = 0; attempt < 3; attempt++) {
      fetchMock
        .mockResolvedValueOnce(outOfStockResponse())
        .mockResolvedValueOnce(outOfStockResponse())
        .mockResolvedValueOnce(outOfStockResponse());
    }

    const err = await createServer("n", "ud", undefined, undefined, "cx23", {
      maxAttempts: 3,
      retryDelayMs: 5,
      sleep,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(HetznerNoCapacityError);
    expect(err.code).toBe("no_capacity");
    expect(err.serverType).toBe("cx23");
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(postCalls(fetchMock)).toHaveLength(9);
  });

  it("does not retry non-capacity errors", async () => {
    const sleep = vi.fn(async () => {});
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { code: "forbidden", message: "nope" } }),
    );

    await expect(
      createServer("n", "ud", undefined, undefined, "cx23", { maxAttempts: 3, sleep }),
    ).rejects.toBeInstanceOf(HetznerApiError);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("defaults to a single attempt (no sleep) when options are omitted", async () => {
    fetchMock
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(outOfStockResponse());
    await expect(createServer("n", "ud")).rejects.toBeInstanceOf(HetznerNoCapacityError);
    // 3 POSTs, one walk only, no pre-check
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("createServer waits for the create_server action", () => {
  let fetchMock: FetchMock;
  const originalToken = process.env.HETZNER_API_TOKEN;
  const originalLocations = process.env.HETZNER_LOCATIONS;
  const noSleep = vi.fn(async () => {});

  beforeEach(() => {
    process.env.HETZNER_API_TOKEN = "test-token";
    delete process.env.HETZNER_LOCATIONS;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    noSleep.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalLocations === undefined) delete process.env.HETZNER_LOCATIONS;
    else process.env.HETZNER_LOCATIONS = originalLocations;
    if (originalToken === undefined) delete process.env.HETZNER_API_TOKEN;
    else process.env.HETZNER_API_TOKEN = originalToken;
  });

  it("polls GET /actions/:id while running and returns once it succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(createdResponse(20, "running"))
      .mockResolvedValueOnce(actionResponse("running"))
      .mockResolvedValueOnce(actionResponse("success"));

    const server = await createServer("srv", "#cloud-config", undefined, undefined, "cx23", {
      sleep: noSleep,
      actionPollMs: 2000,
    });

    expect(server.id).toBe(20);
    expect(getCalls(fetchMock)).toEqual([
      "https://api.hetzner.cloud/v1/actions/99",
      "https://api.hetzner.cloud/v1/actions/99",
    ]);
    expect(noSleep).toHaveBeenCalledTimes(2);
    expect(noSleep).toHaveBeenCalledWith(2000);
  });

  it("does not poll when POST already reports the action as success", async () => {
    fetchMock.mockResolvedValueOnce(createdResponse(21, "success"));
    await createServer("srv", "#cloud-config");
    expect(getCalls(fetchMock)).toEqual([]);
  });

  it("treats a failed create_server action as out of stock: deletes the phantom and tries the next location (2026-09-21: 201 then resource_unavailable 22 s later)", async () => {
    fetchMock
      .mockResolvedValueOnce(createdResponse(30, "running")) // hel1
      .mockResolvedValueOnce(actionResponse("error", { code: "resource_unavailable", message: "resource is currently unavailable" }))
      .mockResolvedValueOnce(deletedResponse()) // DELETE /servers/30
      .mockResolvedValueOnce(createdResponse(31, "success")); // nbg1

    const server = await createServer("srv", "#cloud-config", undefined, undefined, "cx23", {
      sleep: noSleep,
    });

    expect(server.id).toBe(31);
    expect(server.location).toBe("nbg1");
    expect(postCalls(fetchMock).map((p) => p.body.location)).toEqual(["hel1", "nbg1"]);
    expect(deleteCalls(fetchMock)).toEqual(["https://api.hetzner.cloud/v1/servers/30"]);
  });

  it("ignores 404 when the phantom server is already gone", async () => {
    fetchMock
      .mockResolvedValueOnce(createdResponse(40, "running"))
      .mockResolvedValueOnce(actionResponse("error", { code: "resource_unavailable", message: "gone" }))
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "not_found", message: "server not found", details: {} } }))
      .mockResolvedValueOnce(createdResponse(41, "success"));

    const server = await createServer("srv", "#cloud-config", undefined, undefined, "cx23", { sleep: noSleep });
    expect(server.id).toBe(41);
  });

  it("throws HetznerNoCapacityError when every location's create action fails", async () => {
    for (let i = 0; i < 3; i++) {
      fetchMock
        .mockResolvedValueOnce(createdResponse(50 + i, "running"))
        .mockResolvedValueOnce(actionResponse("error", { code: "resource_unavailable", message: "x" }))
        .mockResolvedValueOnce(deletedResponse());
    }
    await expect(
      createServer("srv", "#cloud-config", undefined, undefined, "cx23", { sleep: noSleep }),
    ).rejects.toBeInstanceOf(HetznerNoCapacityError);
    expect(deleteCalls(fetchMock)).toHaveLength(3);
  });

  it("gives up waiting after actionTimeoutMs and returns the server for the SSH poller to judge", async () => {
    fetchMock
      .mockResolvedValueOnce(createdResponse(60, "running"))
      .mockResolvedValue(actionResponse("running"));

    const server = await createServer("srv", "#cloud-config", undefined, undefined, "cx23", {
      sleep: noSleep,
      actionTimeoutMs: 0,
    });

    expect(server.id).toBe(60);
    expect(getCalls(fetchMock)).toEqual([]);
  });
});

describe("HetznerApiError", () => {
  let fetchMock: FetchMock;
  const originalToken = process.env.HETZNER_API_TOKEN;

  beforeEach(() => {
    process.env.HETZNER_API_TOKEN = "test-token";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalToken === undefined) delete process.env.HETZNER_API_TOKEN;
    else process.env.HETZNER_API_TOKEN = originalToken;
  });

  it("exposes status and the parsed Hetzner error code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, {
        error: {
          code: "resource_limit_exceeded",
          message: "server limit exceeded",
          details: null,
        },
      }),
    );

    const err = await createServer("srv", "#cloud-config").catch((e) => e);

    expect(err).toBeInstanceOf(HetznerApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe("resource_limit_exceeded");
    expect(err.apiMessage).toBe("server limit exceeded");
    expect(err.message).toContain("Hetzner API error 403 on POST /servers");
  });

  it("leaves code null when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>bad gateway</html>", { status: 502 }),
    );

    const err = await createServer("srv", "#cloud-config").catch((e) => e);

    expect(err).toBeInstanceOf(HetznerApiError);
    expect(err.status).toBe(502);
    expect(err.code).toBeNull();
  });
});
