import { SearchResponse } from "ep_search/setup";
import { getBasePath } from "./util";

export function escapeForText(query: string): string {
  let escaped = query;
  escaped = escaped.replace(/\\/g, "\\\\");
  escaped = escaped.replace(/:/g, "\\:");
  escaped = escaped.replace(/\(/g, "\\(");
  escaped = escaped.replace(/\)/g, "\\)");
  escaped = escaped.replace(/\[/g, "\\[");
  escaped = escaped.replace(/\]/g, "\\]");
  escaped = escaped.replace(/\{/g, "\\{");
  escaped = escaped.replace(/\}/g, "\\}");
  escaped = escaped.replace(/\//g, "\\/");
  escaped = escaped.replace(/"/g, '\\"');
  escaped = escaped.replace(/ /g, "\\ ");
  escaped = escaped.replace(/~/g, "\\~");
  escaped = escaped.replace(/!/g, "\\!");
  return escaped;
}

export const SORT_BY_SIMILARITY = "similarity";

export type QueryResponse = SearchResponse & {
  // Present for similarity queries: false when the current pad has no vector yet
  similarity?: boolean;
};

function queryURL(
  query: string,
  start?: number,
  rows?: number,
  sort?: string
) {
  const basePath = getBasePath();
  const opts = [];
  if (start !== undefined) {
    opts.push(`&start=${start}`);
  }
  if (rows !== undefined) {
    opts.push(`&rows=${rows}`);
  }
  if (sort === SORT_BY_SIMILARITY) {
    return `${basePath}/ep_weave/related?query=${encodeURIComponent(
      query
    )}&pad=${encodeURIComponent(clientVars.padId)}${opts.join("")}`;
  }
  const reqSort = sort || "indexed desc";
  return `${basePath}/search/?query=${encodeURIComponent(
    query
  )}&sort=${encodeURIComponent(reqSort)}${opts.join("")}`;
}

export function query(
  query: string,
  start?: number,
  rows?: number,
  sort?: string
): Promise<QueryResponse> {
  return new Promise((resolve, reject) => {
    $.getJSON(queryURL(query, start, rows, sort), (data: QueryResponse) => {
      resolve(data);
    }).fail((err) => {
      reject(err);
    });
  });
}
