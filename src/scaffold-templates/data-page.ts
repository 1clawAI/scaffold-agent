/**
 * Generated `/data` page — The Graph subgraph search + GraphQL query UI.
 */

import type { GraphIntegration } from "../types.js";
import {
  PAGE_CARD,
  PAGE_CARD_TITLE,
  PAGE_HEADER,
  PAGE_HEADER_ICON,
  PAGE_HEADER_SUBTITLE,
  PAGE_HEADER_TITLE,
  PAGE_MAIN,
  PAGE_SHELL,
} from "./page-layout.js";

export type DataPageFramework = "next" | "vite";

export function dataPageSource(
  framework: DataPageFramework,
  graphIntegration: GraphIntegration,
): string {
  const useClient = framework === "next" ? `"use client";\n\n` : "";
  const enableQuery = graphIntegration === "x402" || graphIntegration === "both";
  const mcpOnly = graphIntegration === "mcp";

  const modeHint = mcpOnly
    ? `Subgraph search runs in the browser via <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/api/graph/search</code>. For GraphQL queries at dev time, use the Subgraph MCP server in Cursor (see <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.cursor/mcp.json</code>).`
    : enableQuery
      ? `Queries pay per-use in USDC via x402, signed by the 1claw HSM key on Base (private key never leaves hardware). Optional <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GRAPH_API_KEY</code> enables high-volume fallback.`
      : "";

  const querySection = enableQuery
    ? `
        <section className="${PAGE_CARD}">
          <h2 className="${PAGE_CARD_TITLE}">GraphQL query</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste a GraphQL query for the selected subgraph. x402 payment is signed by the 1claw HSM signing key (fund with USDC on Base).
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="subgraph-id">
              Subgraph ID
            </label>
            <Input
              id="subgraph-id"
              value={subgraphId}
              onChange={(e) => setSubgraphId(e.target.value)}
              placeholder="0x… subgraph ID from search"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="graphql-query">
              Query
            </label>
            <textarea
              id="graphql-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={10}
              spellCheck={false}
              className="flex w-full rounded-lg border border-input bg-transparent px-4 py-3 text-xs font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runQuery()} disabled={queryBusy || !subgraphId.trim() || !query.trim()}>
              {queryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Run query
            </Button>
          </div>
          {queryError ? (
            <p className="text-sm text-destructive whitespace-pre-wrap">{queryError}</p>
          ) : null}
          {queryResult ? (
            <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs font-mono whitespace-pre-wrap break-all">
              {queryResult}
            </pre>
          ) : null}
        </section>`
    : `
        <section className="${PAGE_CARD}">
          <h2 className="${PAGE_CARD_TITLE}">GraphQL queries</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This project uses <strong className="text-foreground">Subgraph MCP</strong> for IDE-time queries.
            Open Cursor and use the subgraph tools from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.cursor/mcp.json</code>, or ask the chat agent
            after enabling x402 Graph integration.
          </p>
          <Button variant="secondary" size="sm" asChild>
            <a href="https://thegraph.com/docs/" target="_blank" rel="noreferrer">
              The Graph docs
            </a>
          </Button>
        </section>`;

  const queryStateAndHandlers = enableQuery
    ? `
  const [subgraphId, setSubgraphId] = useState("");
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<string | null>(null);

  const runQuery = useCallback(async () => {
    const id = subgraphId.trim();
    const q = query.trim();
    if (!id || !q) return;
    setQueryBusy(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const res = await fetch("/api/graph/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subgraphId: id, query: q }),
      });
      const data = (await res.json()) as { result?: unknown; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setQueryResult(JSON.stringify(data.result, null, 2));
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : String(e));
    } finally {
      setQueryBusy(false);
    }
  }, [subgraphId, query]);`
    : `
  const [subgraphId, setSubgraphId] = useState("");`;

  return `${useClient}import { useCallback, useState } from "react";
import { Database, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubgraphHit = { id: string; displayName: string; description: string };
${enableQuery ? `
const DEFAULT_QUERY = \`{
  _meta {
    block {
      number
    }
  }
}\`;` : ""}

export default function DataPage() {
  const [keyword, setKeyword] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SubgraphHit[]>([]);
${queryStateAndHandlers}

  const runSearch = useCallback(async () => {
    const kw = keyword.trim();
    if (!kw) return;
    setSearchBusy(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/graph/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw, first: 8 }),
      });
      const data = (await res.json()) as { results?: SubgraphHit[]; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      setResults([]);
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearchBusy(false);
    }
  }, [keyword]);

  return (
    <div className="${PAGE_SHELL}">
      <div className="${PAGE_HEADER}">
        <div className="${PAGE_HEADER_ICON}">
          <Database className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="${PAGE_HEADER_TITLE}">Subgraph data</h1>
          <p className="${PAGE_HEADER_SUBTITLE}">
            The Graph — search indexed protocols and run GraphQL queries
          </p>
        </div>
      </div>

      <main className="${PAGE_MAIN}">
        <p className="text-sm text-muted-foreground leading-relaxed">
          ${modeHint}{" "}
          <a
            href="https://thegraph.com/docs/en/subgraphs/tooling/x402-payments/"
            className="underline hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            x402 guide
          </a>
        </p>

        <section className="${PAGE_CARD}">
          <h2 className="${PAGE_CARD_TITLE}">Discover subgraphs</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. uniswap, aave, ens"
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
            />
            <Button type="button" onClick={() => void runSearch()} disabled={searchBusy || !keyword.trim()}>
              {searchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
          {searchError ? (
            <p className="text-sm text-destructive whitespace-pre-wrap">{searchError}</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="space-y-3">
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSubgraphId(s.id);${enableQuery ? `
                      setQueryResult(null);
                      setQueryError(null);` : ""}
                    }}
                    className="w-full rounded-lg border border-border bg-muted/20 p-4 text-left hover:bg-accent/50 transition-colors"
                  >
                    <div className="font-medium text-sm">{s.displayName}</div>
                    <div className="text-xs font-mono text-muted-foreground break-all mt-1">{s.id}</div>
                    {s.description ? (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.description}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : !searchBusy && keyword.trim() ? (
            <p className="text-sm text-muted-foreground">No subgraphs found — try another keyword.</p>
          ) : null}
        </section>
${querySection}
      </main>
    </div>
  );
}
`;
}
