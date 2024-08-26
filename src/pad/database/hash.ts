import { SearchEngine, PadType } from "ep_search/setup";
import { tokenize } from "../static/js/parser";
import { logPrefix } from "../util/log";
import { getHashQuery } from "../static/js/hash";
import { applyReplaceSet, ReplaceSet, getAText } from "./text";

const api = require("ep_etherpad-lite/node/db/API");
const { decode, encode } = require("he");

export type HashUpdate = {
  oldTitle: string;
  newTitle: string;
};

const MAX_PAGES = 10000;

function replaceHashToken(
  token: string,
  oldTitle: string,
  newTitle: string,
  offset: number
): ReplaceSet | null {
  if (token === `#${oldTitle}`) {
    return {
      start: offset,
      ndel: oldTitle.length + 1,
      text: `#${newTitle}`,
    };
  }
  return null;
}

function replaceHashTokens(
  token: string,
  updates: HashUpdate[],
  offset: number
): ReplaceSet | null {
  for (const update of updates) {
    const { oldTitle, newTitle } = update;
    const replaced = replaceHashToken(token, oldTitle, newTitle, offset);
    if (replaced !== null) {
      return replaced;
    }
  }
  return null;
}

function replaceHash(text: string, updates: HashUpdate[]): ReplaceSet[] {
  let remain = text;
  let offset = 0;
  let replaceSet: ReplaceSet[] = [];
  while (remain.length > 0) {
    const token = tokenize(remain);
    const replacedToken = replaceHashTokens(token, updates, offset);
    if (replacedToken !== null) {
      replaceSet.push(replacedToken);
    }
    remain = remain.substring(token.length);
    offset += token.length;
  }
  return replaceSet;
}

export async function updateHash(padId: string, updates: HashUpdate[]) {
  const { text } = await getAText(padId);
  console.debug(
    logPrefix,
    "Update hash with text",
    padId,
    ", src=",
    text,
    ", updates=",
    updates
  );
  const replaceSet = replaceHash(text, updates);
  if (replaceSet.length === 0) {
    console.warn(logPrefix, "Hash not found in HTML", updates, text);
    return padId;
  }
  await applyReplaceSet(padId, replaceSet);
  console.debug(
    logPrefix,
    "Update hash with text",
    padId,
    ", src=",
    text,
    ", dest=",
    replaceSet
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
