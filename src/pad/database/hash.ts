import HTMLParser, { Node } from "node-html-parser";
import { SearchEngine, PadType } from "ep_search/setup";
import { tokenize } from "../static/js/parser";
import { logPrefix } from "../util/log";
import { escapeForText } from "../static/js/result";

const api = require("ep_etherpad-lite/node/db/API");
const { decode, encode } = require("he");

const MAX_PAGES = 10000;

function replaceHashToken(token: string, oldtitle: string, newtitle: string) {
  if (token === `#${oldtitle}`) {
    return `#${newtitle}`;
  }
  return token;
}

function replaceHash(text: string, oldtitle: string, newtitle: string) {
  let newtext = "";
  let remain = text;
  while (remain.length > 0) {
    const token = tokenize(remain);
    newtext += replaceHashToken(token, oldtitle, newtitle);
    remain = remain.substring(token.length);
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

function replaceHashHtml(html: string, oldtitle: string, newtitle: string) {
  let html_ = html;
  const m = html.match(/^\<\!DOCTYPE\s+HTML\>(.+)$/);
  if (m) {
    html_ = m[1];
  }
  const root = HTMLParser.parse(html_);
  traverseNodes(root, (node) => {
    if (node.nodeType !== 3 /* Node.TEXT_NODE */) {
      return;
    }
    node.rawText = encode(
      replaceHash(decode(node.rawText), oldtitle, newtitle)
    );
  });
  return root.toString();
}

async function updateHash(pad: PadType, oldtitle: string, newtitle: string) {
  const { html } = await api.getHTML(pad.id);
  console.debug(logPrefix, "Update hash with text", pad, ", src=", html);
  const newhtml = replaceHashHtml(html, oldtitle, newtitle);
  await api.setHTML(pad.id, newhtml);
  console.debug(
    logPrefix,
    "Update hash with text",
    pad,
    ", src=",
    html,
    ", desst=",
    newhtml
  );
  return pad.id;
}

export async function updateHashes(
  searchEngine: SearchEngine,
  oldtitle: string,
  newtitle: string
) {
  const results = await searchEngine.search(
    `hash:"#${escapeForText(oldtitle)}"`,
    {
      rows: MAX_PAGES + 1,
    }
  );
  const { docs: pads, numFound } = results;
  if (numFound >= MAX_PAGES) {
    console.warn(logPrefix, `Too many references for ${oldtitle}: ${numFound}`);
  }
  const updates = await Promise.all(
    pads.map((pad) => updateHash(pad, oldtitle, newtitle))
  );
  return {
    updates,
  };
}
