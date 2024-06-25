import { PadType } from "ep_search/setup";
import { extractTitle } from "./database/title";
import { logPrefix } from "./util/log";

const LENGTH_SHORT_TEXT = 32;

function extractCreated(pad: PadType) {
  const revs = (pad.savedRevisions || []).map((rev) => rev.timestamp);
  revs.sort();
  if (revs.length === 0) {
    return null;
  }
  return new Date(revs[0]).toISOString();
}

function extractShortText(text: string) {
  const titleIndex = text.indexOf("\n");
  let atext = text;
  if (titleIndex >= 0) {
    atext = text.substring(titleIndex + 1).trim();
  }
  return atext.length > LENGTH_SHORT_TEXT
    ? `${atext.substring(0, LENGTH_SHORT_TEXT)}...`
    : atext;
}

exports.create = (pluginSettings: any) => (pad: PadType) => {
  const atext = (pad.atext || {}).text || "";
  const shorttext = extractShortText(atext);
  const result: {
    indexed: string;
    id: string;
    _text_: string;
    atext: string;
    title: string;
    hash: string;
    shorttext: string;
    created?: string;
  } = {
    indexed: new Date().toISOString(),
    id: pad.id,
    _text_: atext,
    atext,
    title: extractTitle(pad),
    hash: atext,
    shorttext,
  };
  const created = extractCreated(pad);
  if (created !== null) {
    result.created = created;
  }
  console.debug(logPrefix, "serialize", pad, result);
  return result;
};
