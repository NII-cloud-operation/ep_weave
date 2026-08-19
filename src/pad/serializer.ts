import { PadType } from "ep_search/setup";
import { extractTitle } from "./database/title";
import { logPrefix } from "./util/log";

const LENGTH_SHORT_TEXT = 32;

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

exports.create = (pluginSettings: any) => async (pad: PadType) => {
  const atext = (pad.atext || {}).text || "";
  const shorttext = extractShortText(atext);
  const result = {
    indexed: new Date(await pad.getLastEdit()).toISOString(),
    created: new Date(await pad.getRevisionDate(0)).toISOString(),
    id: pad.id,
    _text_: atext,
    atext,
    title: extractTitle(pad),
    hash: atext,
    shorttext,
  };
  console.debug(logPrefix, "serialize", pad, result);
  return result;
};
