import fs from "fs";
import { Request, Response, NextFunction } from "express";
import HTMLParser, { Node } from "node-html-parser";
import { createSearchEngine, SearchEngine, PadType } from "ep_search/setup";
import {
  ExpressCreateServerArgs,
  PreAuthorizeArgs,
} from "ep_etherpad-lite/hooks";
import { tokenize } from "./static/js/parser";

const absolutePaths = require("ep_etherpad-lite/node/utils/AbsolutePaths");
const argv = require("ep_etherpad-lite/node/utils/Cli").argv;
const { v4: uuidv4 } = require("uuid");
const settings = require("ep_etherpad-lite/node/utils/Settings");
const api = require("ep_etherpad-lite/node/db/API");
const { decode, encode } = require("he");

const logPrefix = "[ep_weave]";
let apikey: string | null = null;

async function getPadIdsByTitle(searchEngine: SearchEngine, title: string) {
  const results = await searchEngine.search(`title:"${title}"`);
  console.debug(logPrefix, `Search by title ${title}`, results);
  if (!results) {
    return null;
  }
  const { docs } = results;
  const ids = docs
    .filter((result) => result.title === title)
    .map((result) => result.id);
  if (ids.length === 0) {
    return null;
  }
  ids.sort();
  console.info(logPrefix, "Redirecting...", title, ids[0]);
  return ids;
}

async function createNewPadForTitle(
  title: string,
  req: {
    query: {
      body?: string;
    };
  }
) {
  console.info(logPrefix, "Create pad", title);
  const padId = uuidv4();
  const body = req.query.body || "";
  await api.createPad(padId, `${title}\n\n${body}`);
  return padId;
}

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
    traverseNodes(node, handler);
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

async function updateHashes(
  searchEngine: SearchEngine,
  oldtitle: string,
  newtitle: string
) {
  const results = await searchEngine.search(`hash:"#${oldtitle}"`);
  const { docs: pads } = results;
  const updates = await Promise.all(
    pads.map((pad) => updateHash(pad, oldtitle, newtitle))
  );
  return {
    updates,
  };
}

exports.preAuthorize = (
  hookName: any,
  args: PreAuthorizeArgs,
  cb: (authorized?: boolean) => void
) => {
  const { req } = args;
  const m = req.originalUrl.match(/^\/ep_weave(\/.+)/);
  if (!m) {
    cb();
    return;
  }
  const path = m[1];
  if (path.match(/^\/api\/.+/)) {
    console.debug(
      logPrefix,
      "preAuthorize: Grant access for API",
      req.originalUrl
    );
    cb(true);
    return;
  }
  cb();
};

exports.registerRoute = (
  hookName: any,
  args: ExpressCreateServerArgs,
  cb: (next: any) => void
) => {
  const pluginSettings = settings.ep_search || {};
  const searchEngine = createSearchEngine(pluginSettings);
  const apikeyFilename = absolutePaths.makeAbsolute(
    argv.apikey || "./APIKEY.txt"
  );
  try {
    apikey = fs.readFileSync(apikeyFilename, "utf8");
    console.info(logPrefix, `Api key file read from: "${apikeyFilename}"`);
  } catch (e) {
    console.warn(logPrefix, `Api key file "${apikeyFilename}" cannot read.`);
  }
  const apikeyChecker = (req: Request, res: Response, next: NextFunction) => {
    const reqApikey = req.query.apikey;
    if (typeof reqApikey !== "string") {
      return res.status(400).send("Bad Request");
    }
    if (!reqApikey.trim()) {
      return res.status(401).send("Authentication Required");
    }
    if (!apikey) {
      return res.status(401).send("Authentication Required");
    }
    if (reqApikey.trim() !== apikey.trim()) {
      return res.status(403).send("Unauthorized");
    }
    next();
  };
  const searchHandler = (req: Request, res: Response) => {
    const searchString = req.query.query || req.query.q;
    if (typeof searchString !== "string") {
      res.status(400).send({
        error: "Bad Request",
      });
      return;
    }
    searchEngine
      .search(searchString)
      .then((result) => {
        res.send(JSON.stringify(result));
      })
      .catch((err) => {
        console.error(
          logPrefix,
          "Error occurred",
          err.stack || err.message || String(err)
        );
        res.status(500).send({
          error: err.toString(),
        });
      });
  };
  const { app } = args;
  app.get("/ep_weave/api/search", apikeyChecker, searchHandler);
  app.get("/t/:title", (req, res) => {
    const { title } = req.params;
    getPadIdsByTitle(searchEngine, title)
      .then((ids) => {
        if (ids === null) {
          createNewPadForTitle(title, req)
            .then((id) => {
              res.redirect(`/p/${id}`);
            })
            .catch((err) => {
              console.error(
                logPrefix,
                "Error occurred",
                err.stack || err.message || String(err)
              );
              res.status(500).send({
                error: err.toString(),
              });
            });
          return;
        }
        res.redirect(`/p/${ids[0]}`);
      })
      .catch((err) => {
        console.error(
          logPrefix,
          "Error occurred",
          err.stack || err.message || String(err)
        );
        res.status(500).send({
          error: err.toString(),
        });
      });
  });
  app.put("/ep_weave/hashes", (req, res) => {
    const { oldtitle, newtitle } = req.query;
    if (!oldtitle || !newtitle) {
      res.status(400).send({
        error: "Missing parameters",
      });
      return;
    }
    if (typeof oldtitle !== "string" || typeof newtitle !== "string") {
      res.status(400).send({
        error: "Invalid parameters",
      });
      return;
    }
    console.debug(logPrefix, "Update", oldtitle, newtitle);
    updateHashes(searchEngine, oldtitle, newtitle)
      .then((result) => {
        res.send(JSON.stringify(result));
      })
      .catch((err) => {
        console.error(
          logPrefix,
          "Error occurred",
          err.stack || err.message || String(err)
        );
        res.status(500).send({
          error: err.toString(),
        });
      });
  });
  cb(null);
};
