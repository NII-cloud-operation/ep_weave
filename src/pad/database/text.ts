const api = require("ep_etherpad-lite/node/db/API");
const padMessageHandler = require("ep_etherpad-lite/node/handler/PadMessageHandler");
const CustomError = require('ep_etherpad-lite/node/utils/customError');
const padManager = require('ep_etherpad-lite/node/db/PadManager');

// based on https://github.com/ether/etherpad-lite/blob/develop/src/node/db/API.ts
// ... This is required to use spliceText, which is not exported in the API

// gets a pad safe
const getPadSafe = async (padID: string|object, shouldExist: boolean, text?:string, authorId:string = '') => {
  // check if padID is a string
  if (typeof padID !== 'string') {
    throw new CustomError('padID is not a string', 'apierror');
  }

  // check if the padID maches the requirements
  if (!padManager.isValidPadId(padID)) {
    throw new CustomError('padID did not match requirements', 'apierror');
  }

  // check if the pad exists
  const exists = await padManager.doesPadExists(padID);

  if (!exists && shouldExist) {
    // does not exist, but should
    throw new CustomError('padID does not exist', 'apierror');
  }

  if (exists && !shouldExist) {
    // does exist, but shouldn't
    throw new CustomError('padID does already exist', 'apierror');
  }

  // pad exists, let's get it
  return padManager.getPad(padID, text, authorId);
};

export type ReplaceSet = {
  start: number;
  ndel: number;
  text: string;
};

export async function applyReplaceSet(
  padID: string,
  replaceSet: ReplaceSet[],
  authorId: string = ""
) {
  const pad = await getPadSafe(padID, true);

  const sortedReplaceSet = new Array<ReplaceSet>(...replaceSet)
    .sort((a, b) => a.start - b.start)
    .reverse();
  for (const replaceSet of sortedReplaceSet) {
    const { start, ndel, text } = replaceSet;
    await pad.spliceText(start, ndel, text, authorId);
  }
  await padMessageHandler.updatePadClients(pad);
}

export async function getAText(padID: string) {
  const pad = await getPadSafe(padID, true);
  return pad.atext;
}
