/** Generated Next.js / Vite API routes for The Graph search + query. */

export function nextApiGraphSearchRoute(): string {
  return `import { searchSubgraphs } from "@/lib/graph-client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const keyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";
    const first = Number(body?.first ?? 8);
    if (!keyword) {
      return Response.json({ error: "keyword is required" }, { status: 400 });
    }
    if (!Number.isFinite(first) || first < 1 || first > 25) {
      return Response.json({ error: "first must be 1–25" }, { status: 400 });
    }
    const results = await searchSubgraphs(keyword, first);
    return Response.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/graph/search]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
`;
}

export function nextApiGraphQueryRoute(): string {
  return `import { querySubgraph } from "@/lib/graph-client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const subgraphId = typeof body?.subgraphId === "string" ? body.subgraphId.trim() : "";
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const variables =
      body?.variables && typeof body.variables === "object" && !Array.isArray(body.variables)
        ? (body.variables as Record<string, unknown>)
        : undefined;
    if (!subgraphId) {
      return Response.json({ error: "subgraphId is required" }, { status: 400 });
    }
    if (!query) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }
    const result = await querySubgraph(subgraphId, query, variables);
    return Response.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/graph/query]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
`;
}

/** Express routes appended to Vite \`server.ts\` when Graph is enabled. */
export function viteGraphExpressBlock(enableQuery: boolean): string {
  const queryRoute = enableQuery
    ? `
app.post("/api/graph/query", async (req, res) => {
  try {
    const { subgraphId, query, variables } = req.body ?? {};
    const id = typeof subgraphId === "string" ? subgraphId.trim() : "";
    const q = typeof query === "string" ? query.trim() : "";
    const vars =
      variables && typeof variables === "object" && !Array.isArray(variables)
        ? variables
        : undefined;
    if (!id) {
      res.status(400).json({ error: "subgraphId is required" });
      return;
    }
    if (!q) {
      res.status(400).json({ error: "query is required" });
      return;
    }
    const { querySubgraph } = await import("./src/lib/graph-client.js");
    const result = await querySubgraph(id, q, vars);
    res.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/graph/query]", msg);
    res.status(500).json({ error: msg });
  }
});
`
    : "";

  return `
app.post("/api/graph/search", async (req, res) => {
  try {
    const { keyword, first: rawFirst } = req.body ?? {};
    const kw = typeof keyword === "string" ? keyword.trim() : "";
    const first = Number(rawFirst ?? 8);
    if (!kw) {
      res.status(400).json({ error: "keyword is required" });
      return;
    }
    if (!Number.isFinite(first) || first < 1 || first > 25) {
      res.status(400).json({ error: "first must be 1–25" });
      return;
    }
    const { searchSubgraphs } = await import("./src/lib/graph-client.js");
    const results = await searchSubgraphs(kw, first);
    res.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/graph/search]", msg);
    res.status(500).json({ error: msg });
  }
});
${queryRoute}`;
}
