import HTMLParser, { Node } from "node-html-parser";
import { SearchEngine, PadType } from "ep_search/setup";
import { tokenize } from "../static/js/parser";
import { logPrefix } from "../util/log";
import { getHashQuery } from "../static/js/hash";

const api = require("ep_etherpad-lite/node/db/API");
const { decode, encode } = require("he");

export type HashUpdate = {
  oldTitle: string;
  newTitle: string;
};

const MAX_PAGES = 10000;

function replaceHashToken(token: string, oldTitle: string, newTitle: string) {
  if (token === `#${oldTitle}`) {
    return `#${newTitle}`;
  }
  return token;
}

function replaceHashTokens(token: string, updates: HashUpdate[]) {
  for (const update of updates) {
    const { oldTitle, newTitle } = update;
    const replaced = replaceHashToken(token, oldTitle, newTitle);
    if (replaced !== token) {
      return replaced;
    }
  }
  return null;
}

function replaceHash(text: string, updates: HashUpdate[]): string | null {
  let newtext = "";
  let remain = text;
  let replaced = false;
  while (remain.length > 0) {
    const token = tokenize(remain);
    const replacedToken = replaceHashTokens(token, updates);
    if (replacedToken !== null) {
      newtext += replacedToken;
      remain = remain.substring(token.length);
      replaced = true;
      continue;
    }
    newtext += token;
    remain = remain.substring(token.length);
  }
  if (!replaced) {
    return null;
  }
  return newtext;
}

function traverseNodes(node: Node, handler: (node: Node) => void) {
  handler(node);
  (node.childNodes || []).forEach((child: Node) => {
    handler(child);
    traverseNodes(child, handler);
  });
}

function replaceHashHtml(html: string, updates: HashUpdate[]) {
  let html_ = html;
  const m = html.match(/^\<\!DOCTYPE\s+HTML\>(.+)$/);
  if (m) {
    html_ = m[1];
  }
  const root = HTMLParser.parse(html_);
  let replaced = false;
  traverseNodes(root, (node) => {
    if (node.nodeType !== 3 /* Node.TEXT_NODE */) {
      return;
    }
    const replacedText = replaceHash(decode(node.rawText), updates);
    if (replacedText === null) {
      return;
    }
    replaced = true;
    node.rawText = encode(replacedText);
  });
  if (!replaced) {
    return null;
  }
  return root.toString();
}

export async function updateHash(padId: string, updates: HashUpdate[]) {
  const { html } = await api.getHTML(padId);
  console.debug(
    logPrefix,
    "Update hash with text",
    padId,
    ", src=",
    html,
    ", updates=",
    updates
  );
  const newhtml = replaceHashHtml(html, updates);
  if (newhtml === null) {
    console.warn(logPrefix, "Hash not found in HTML", updates, html);
    return padId;
  }
  await api.setHTML(padId, newhtml);
  console.debug(
    logPrefix,
    "Update hash with text",
    padId,
    ", src=",
    html,
    ", dest=",
    newhtml
  );
  return padId;
}

export async function searchHashes(
  searchEngine: SearchEngine,
  oldTitle: string
) {
  console.debug(logPrefix, "Search hashes", oldTitle);
  const results = await searchEngine.search(getHashQuery(oldTitle), {
    rows: MAX_PAGES + 1,
  });
  const { docs: pads, numFound } = results;
  if (numFound >= MAX_PAGES) {
    console.warn(logPrefix, `Too many references for ${oldTitle}: ${numFound}`);
  }
  return pads;
}

export async function updateHashes(
  searchEngine: SearchEngine,
  oldTitle: string,
  newTitle: string
) {
  const pads = await searchHashes(searchEngine, oldTitle);
  const updates = await Promise.all(
    pads.map((pad) => updateHash(pad.id, [{ oldTitle, newTitle }]))
  );
  return {
    updates,
  };
}
