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

export function query(
  query: string,
  start?: number,
  rows?: number,
  sort?: string
): Promise<SearchResponse> {
  return new Promise((resolve, reject) => {
    const opts = [];
    const reqSort = sort || "indexed desc";
    opts.push(`&sort=${encodeURIComponent(reqSort.toString())}`);
    if (start !== undefined) {
      opts.push(`&start=${start}`);
    }
    if (rows !== undefined) {
      opts.push(`&rows=${rows}`);
    }
    const basePath = getBasePath();
    $.getJSON(
      `${basePath}/search/?query=${encodeURIComponent(query)}${opts.join("")}`,
      (data: SearchResponse) => {
        resolve(data);
      }
    ).fail((err) => {
      reject(err);
    });
  });
}
