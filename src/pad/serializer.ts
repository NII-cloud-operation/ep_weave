import { PadType } from "ep_search/setup";
import { extractTitle } from "./database/title";
import { embed, isEnabled } from "./embedding";
import { logPrefix } from "./util/log";

const LENGTH_SHORT_TEXT = 32;

function extractBody(text: string) {
  const titleIndex = text.indexOf("\n");
  if (titleIndex < 0) {
    return text;
  }
  return text.substring(titleIndex + 1).trim();
}

function extractShortText(body: string) {
  return body.length > LENGTH_SHORT_TEXT
    ? `${body.substring(0, LENGTH_SHORT_TEXT)}...`
    : body;
}

// Solr's JSON reader hands number tokens longer than 22 characters to
// DenseVectorField as strings, which it rejects. JavaScript prints small doubles
// in positional notation (-0.0000010246448027828592), so bound the length.
function roundForSolr(vector: number[]) {
  return vector.map((value) => Number(value.toFixed(7)));
}

exports.create = (pluginSettings: any) => async (pad: PadType) => {
  const atext = (pad.atext || {}).text || "";
  const title = extractTitle(pad);
  const body = extractBody(atext);
  const result = {
    indexed: new Date(await pad.getLastEdit()).toISOString(),
    created: new Date(await pad.getRevisionDate(0)).toISOString(),
    id: pad.id,
    _text_: atext,
    atext,
    title,
    hash: atext,
    shorttext: extractShortText(body),
    ...(isEnabled() ? { embedding: roundForSolr(await embed(title, body)) } : {}),
  };
  console.debug(logPrefix, "serialize", pad, result);
  return result;
};
