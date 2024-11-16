"use strict";

const common = require("ep_etherpad-lite/tests/backend/common");

let agent: any;
const apiVersion = 1;
const randomString =
  require("ep_etherpad-lite/static/js/pad_utils").randomString;
import { generateJWTToken } from "ep_etherpad-lite/tests/backend/common";

// Creates a pad and returns the pad id. Calls the callback when finished.
const createPad = async (padID: string) => {
  const res = await agent
    .get(`/api/${apiVersion}/createPad?padID=${padID}`)
    .set("Authorization", await generateJWTToken());
  if (res.body.code !== 0) {
    throw new Error("Unable to create new Pad");
  }
  return padID;
};

const setHTML = async (padID: string, html: string) => {
  const newHtml = `/api/${apiVersion}/setHTML?padID=${padID}&html=${html}`;
  console.log("New HTML is", newHtml);
  const res = await agent
    .get(newHtml)
    .set("authorization", await generateJWTToken());
  console.log("Res is", res.body);
  if (res.body.code !== 0) {
    throw new Error("Unable to set pad HTML");
  }
  return padID;
};

const getHTMLEndPointFor = (padID: string) =>
  `/api/${apiVersion}/getHTML?padID=${padID}`;

const buildHTML = (body: string) => `<html><body>${body}</body></html>`;

describe("access via title", function () {
  let padID: string;
  let html: () => string;

  before(async function () {
    agent = await common.init();
    html = () => buildHTML("<p>Title of Sample Pad</p><p>Hello World</p>");
  });

  // create a new pad before each test run
  beforeEach(async function () {
    padID = randomString(5);
    await createPad(padID);
    await setHTML(padID, html());
  });

  it("returns ok", async function () {
    await agent
      .get(getHTMLEndPointFor(padID))
      .set("Authorization", await generateJWTToken())
      .expect("Content-Type", /json/)
      .expect(200);
    throw new Error("Not implemented");
  });
});
