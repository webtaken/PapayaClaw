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

function serverTypesResponse(availability: Record<string, boolean>) {
  return jsonResponse(200, {
    server_types: [
      {
        id: 1,
        name: "cx23",
        locations: Object.entries(availability).map(([name, available], i) => ({
          id: i + 1,
          name,
          deprecation: null,
          recommended: false,
          available,
        })),
      },
    ],
  });
}

function createdResponse(id: number) {
  return jsonResponse(201, {
    server: {
      id,
      name: "srv",
      status: "initializing",
      public_net: { ipv4: { ip: "1.2.3.4" }, ipv6: { ip: "" } },
      server_type: { name: "cx23", description: "CX23" },
      created: "2026-09-16T00:00:00Z",
    },
    action: { id: 99, status: "running" },
  });
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

  it("skips locations the pre-check reports unavailable and creates in the first available one", async () => {
    fetchMock
      .mockResolvedValueOnce(
        serverTypesResponse({ hel1: false, nbg1: true, fsn1: true }),
      )
      .mockResolvedValueOnce(createdResponse(10));

    const server = await createServer(
      "srv",
      "#cloud-config",
      ["k"],
      undefined,
      "cx23",
    );

    expect(getCalls(fetchMock)).toEqual([
      "https://api.hetzner.cloud/v1/server_types?name=cx23",
    ]);
    const posts = postCalls(fetchMock);
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("https://api.hetzner.cloud/v1/servers");
    expect(posts[0].body.location).toBe("nbg1");
    expect(posts[0].body.server_type).toBe("cx23");
    expect(server.id).toBe(10);
    expect(server.location).toBe("nbg1");
  });

  it("falls back to the next location when POST /servers returns resource_unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce(
        serverTypesResponse({ hel1: true, nbg1: true, fsn1: true }),
      )
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(createdResponse(11));

    const server = await createServer("srv", "#cloud-config");

    const posts = postCalls(fetchMock);
    expect(posts.map((p) => p.body.location)).toEqual(["hel1", "nbg1"]);
    expect(server.id).toBe(11);
    expect(server.location).toBe("nbg1");
  });

  it("rethrows non-stock errors without trying other locations", async () => {
    fetchMock
      .mockResolvedValueOnce(
        serverTypesResponse({ hel1: true, nbg1: true, fsn1: true }),
      )
      .mockResolvedValueOnce(
        jsonResponse(422, {
          error: { code: "invalid_input", message: "bad name", details: null },
        }),
      );

    await expect(createServer("srv", "#cloud-config")).rejects.toBeInstanceOf(
      HetznerApiError,
    );
    expect(postCalls(fetchMock)).toHaveLength(1);
  });

  it("throws HetznerNoCapacityError without POSTing when pre-check shows no stock anywhere", async () => {
    fetchMock.mockResolvedValueOnce(
      serverTypesResponse({ hel1: false, nbg1: false, fsn1: false }),
    );

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
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it("throws HetznerNoCapacityError after every location returns resource_unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce(
        serverTypesResponse({ hel1: true, nbg1: true, fsn1: true }),
      )
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(outOfStockResponse());

    await expect(createServer("srv", "#cloud-config")).rejects.toBeInstanceOf(
      HetznerNoCapacityError,
    );
    expect(postCalls(fetchMock).map((p) => p.body.location)).toEqual([
      "hel1",
      "nbg1",
      "fsn1",
    ]);
  });

  it("still attempts creation in preference order when the pre-check request fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(500, {
          error: { code: "server_error", message: "boom", details: null },
        }),
      )
      .mockResolvedValueOnce(createdResponse(12));

    const server = await createServer("srv", "#cloud-config");

    expect(postCalls(fetchMock).map((p) => p.body.location)).toEqual(["hel1"]);
    expect(server.location).toBe("hel1");
  });

  it("attempts every preferred location when the server type is unknown to the pre-check", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { server_types: [] }))
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(createdResponse(13));

    const server = await createServer("srv", "#cloud-config");

    expect(postCalls(fetchMock).map((p) => p.body.location)).toEqual([
      "hel1",
      "nbg1",
    ]);
    expect(server.location).toBe("nbg1");
  });

  it("honors HETZNER_LOCATIONS override for the fallback order", async () => {
    process.env.HETZNER_LOCATIONS = "fsn1,hel1";
    fetchMock
      .mockResolvedValueOnce(
        serverTypesResponse({ hel1: true, nbg1: true, fsn1: true }),
      )
      .mockResolvedValueOnce(outOfStockResponse())
      .mockResolvedValueOnce(createdResponse(14));

    const server = await createServer("srv", "#cloud-config");

    expect(postCalls(fetchMock).map((p) => p.body.location)).toEqual([
      "fsn1",
      "hel1",
    ]);
    expect(server.location).toBe("hel1");
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
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { server_types: [] }))
      .mockResolvedValueOnce(
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
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { server_types: [] }))
      .mockResolvedValueOnce(
        new Response("<html>bad gateway</html>", { status: 502 }),
      );

    const err = await createServer("srv", "#cloud-config").catch((e) => e);

    expect(err).toBeInstanceOf(HetznerApiError);
    expect(err.status).toBe(502);
    expect(err.code).toBeNull();
  });
});
