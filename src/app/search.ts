import type { ToolDef } from "../tools/types";

/**
 * How well a tool matches a query; -1 = no match. Every word of the query must hit the name,
 * a keyword, the category or the description. Name hits rank above keyword hits, prefixes above infixes.
 */
export function matchScore(tool: ToolDef, query: string): number {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const name = tool.name.toLowerCase();
  const nameWords = name.split(/[^a-z0-9]+/).filter(Boolean);
  const keywords = tool.keywords.map((k) => k.toLowerCase());
  const extra = `${tool.category} ${tool.description}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (name.startsWith(w)) score += 100;
    else if (nameWords.some((n) => n.startsWith(w))) score += 70;
    else if (name.includes(w)) score += 50;
    else if (keywords.some((k) => k === w)) score += 40;
    else if (keywords.some((k) => k.startsWith(w))) score += 30;
    else if (keywords.some((k) => k.includes(w))) score += 15;
    else if (extra.includes(w)) score += 5;
    else return -1;
  }
  return score;
}

/** Matching tools, best first; registry order breaks ties. An empty query returns every tool. */
export function searchTools(tools: ToolDef[], query: string): ToolDef[] {
  if (!query.trim()) return tools;
  return tools
    .map((t, i) => ({ t, i, s: matchScore(t, query) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.t);
}
