import HTMLParser, { Node } from "node-html-parser";
import { SearchEngine, PadType } from "ep_search/setup";
import removeMdBase from "remove-markdown";
import { updateHashes } from "./hash";
import { logPrefix } from "../util/log";
import { escapeForText } from "../static/js/result";

const api = require("ep_etherpad-lite/node/db/API");
const db = require("ep_etherpad-lite/node/db/DB").db;
const { decode, encode } = require("he");

const MAX_PAGES = 10000;

type TitleUpdateResult = {
  id: string;
  hashes: {
    updates: string[];
  };
};

function removeMd(baseText: string) {
  const text = removeMdBase(baseText);
  const m = text.match(/^\*+(.+)$/);
  if (m) {
    return m[1];
  }
  return text;
}

export function extractTitle(padData: PadType) {
  const lines = (padData.atext || {}).text.split("\n");
  return removeMd(lines[0]);
}

function traverseNodes(node: Node, handler: (node: Node) => void) {
  handler(node);
  (node.childNodes || []).forEach((child: Node) => {
    handler(child);
    traverseNodes(child, handler);
  });
}

function replaceTitle(text: string, oldtitle: string, newtitle: string) {
  return text.replace(oldtitle, newtitle);
}

function replaceTitleHtml(html: string, oldtitle: string, newtitle: string) {
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
    if (replaced) {
      return;
    }
    const decodedText = decode(node.rawText);
    if (!decodedText.includes(oldtitle)) {
      return;
    }
    replaced = true;
    const replacedText = replaceTitle(decodedText, oldtitle, newtitle);
    console.info(logPrefix, "Title replaced", decodedText, replacedText);
    node.rawText = encode(replacedText);
  });
  if (!replaced) {
    console.warn(logPrefix, "Title not found in HTML", oldtitle, html);
    return html;
  }
  return root.toString();
}

async function updateTitleContent(
  searchEngine: SearchEngine,
  pad: PadType,
  oldTitle: string,
  newTitle: string
): Promise<TitleUpdateResult> {
  console.info(logPrefix, "Update title", pad.id, oldTitle, newTitle);
  const { html } = await api.getHTML(pad.id);
  const replacedHtml = replaceTitleHtml(html, oldTitle, newTitle);
  await api.setHTML(pad.id, replacedHtml);

  console.log(logPrefix, "Update hashes", pad.id);
  const updatedIds = await updateHashes(searchEngine, oldTitle, newTitle);
  return {
    id: pad.id,
    hashes: updatedIds,
  };
}

async function updateTitle(
  searchEngine: SearchEngine,
  pad: PadType,
  oldTitle: string,
  newTitle: string
): Promise<TitleUpdateResult | null> {
  console.log(logPrefix, "Updating", pad);
  const oldChildTitle = pad.title;
  if (!oldChildTitle.startsWith(`${oldTitle}/`)) {
    console.warn(
      logPrefix,
      `Child pad title does not start with parent title: ${oldChildTitle}`
    );
    return null;
  }
  const newChildTitle = newTitle + oldChildTitle.substring(oldTitle.length);
  return await updateTitleContent(
    searchEngine,
    pad,
    oldChildTitle,
    newChildTitle
  );
}

export async function updateTitles(
  searchEngine: SearchEngine,
  oldTitle: string,
  newTitle: string
) {
  if (oldTitle.trim().length === 0 || newTitle.trim().length === 0) {
    throw new Error("Title must not be empty");
  }
  const childPadsQuery = `title:${escapeForText(`${oldTitle}/`)}*`;
  const results = await searchEngine.search(childPadsQuery, {
    rows: MAX_PAGES + 1,
  });
  const { docs: childPads, numFound } = results;
  if (numFound >= MAX_PAGES) {
    console.warn(
      logPrefix,
      `Too many child pads found for ${oldTitle}: ${numFound}`
    );
  }
  const updates = await Promise.all(
    childPads.map((pad: PadType) =>
      updateTitle(searchEngine, pad, oldTitle, newTitle)
    )
  );
  const hashesUpdates = await updateHashes(searchEngine, oldTitle, newTitle);
  return {
    hashes: hashesUpdates,
    titles: updates.filter((update) => update !== null) as TitleUpdateResult[],
  };
}
