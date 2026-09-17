// node-fetch v3+ ships as ESM-only (no CommonJS export), so it can't be
// statically imported from this CommonJS-compiled backend -- doing so
// compiles to a require() call that throws ERR_REQUIRE_ESM at runtime. A
// dynamic import() works from CommonJS regardless of the target module's
// format. node-fetch is kept (over Node's built-in fetch) specifically
// because it supports the `agent` option used to route requests through a
// VPN/SOCKS proxy (see vpnEndpointService.ts) -- something undici's native
// fetch does not support the same way -- and because its Response.body is a
// Node Readable (supports .pipe()/.destroy()), unlike native fetch's WHATWG
// stream.
//
// Types are derived from the default export's own function signature
// (Parameters/ReturnType) rather than importing node-fetch's named types
// directly, since a type-only import of a named export from an ESM-only
// package requires an explicit resolution-mode attribute under this
// project's CommonJS module setting.
type NodeFetchDefault = typeof import("node-fetch", { with: { "resolution-mode": "import" } }).default;
type NodeFetchRequestInfo = Parameters<NodeFetchDefault>[0];
type NodeFetchRequestInit = Parameters<NodeFetchDefault>[1];
type NodeFetchResponse = Awaited<ReturnType<NodeFetchDefault>>;

let fetchImpl: NodeFetchDefault | undefined;

export async function fetch(
  url: NodeFetchRequestInfo,
  init?: NodeFetchRequestInit
): Promise<NodeFetchResponse> {
  if (!fetchImpl) {
    fetchImpl = (await import("node-fetch")).default;
  }
  return fetchImpl(url, init);
}
