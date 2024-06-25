import fs from "fs";
import { Request, Response, NextFunction } from "express";
import { createSearchEngine, SearchEngine } from "ep_search/setup";
import {
  ExpressCreateServerArgs,
  PreAuthorizeArgs,
} from "ep_etherpad-lite/hooks";
import { logPrefix } from "./util/log";
import { updateTitles } from "./database/title";
import { escapeForText } from "./static/js/result";

const absolutePaths = require("ep_etherpad-lite/node/utils/AbsolutePaths");
const argv = require("ep_etherpad-lite/node/utils/Cli").argv;
const { v4: uuidv4 } = require("uuid");
const settings = require("ep_etherpad-lite/node/utils/Settings");
const api = require("ep_etherpad-lite/node/db/API");

let apikey: string | null = null;

async function getPadIdsByTitle(searchEngine: SearchEngine, title: string) {
  const results = await searchEngine.search(
    `title:"${escapeForText(title)}"`
  );
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
  app.get("/t/:title(*)", (req, res) => {
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
    updateTitles(searchEngine, oldtitle, newtitle)
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
