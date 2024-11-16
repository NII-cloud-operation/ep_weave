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
  const encodedHTML = encodeURIComponent(html);
  const newHtml = `/api/${apiVersion}/setHTML?padID=${padID}&html=${encodedHTML}`;
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
  let padID1: string;
  let padID2: string;

  before(async function () {
    agent = await common.init();
    padID1 = randomString(5);
    padID2 = randomString(5);
  });

  it("can access via title", async function () {
    const html1 = () => buildHTML("<p>TESTPAD</p><p>Hello New Pad #PAD2</p>");
    await createPad(padID1);
    await setHTML(padID1, html1());
    await agent
      .get(getHTMLEndPointFor(padID1))
      .set("Authorization", await generateJWTToken())
      .expect("Content-Type", /json/)
      .expect(200);
    await new Promise((resolve) => setTimeout(resolve, 60000));
    await agent
      .get(`/t/TESTPAD`)
      .expect(302)
      .expect("Location", `/p/${padID1}`);
    const html2 = () => buildHTML("<p>PAD2</p><p>2nd Pad</p>");
    await createPad(padID2);
    await setHTML(padID2, html2());
    await agent
      .get(getHTMLEndPointFor(padID2))
      .set("Authorization", await generateJWTToken())
      .expect("Content-Type", /json/)
      .expect(200);
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await agent.get(`/t/PAD2`).expect(302).expect("Location", `/p/${padID2}`);
  });

  it("can update hash", async function () {
    const html2Rev = () => buildHTML("<p>NewPad2</p><p>Updated 2nd Pad</p>");
    await setHTML(padID2, html2Rev());
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await agent
      .get(`/t/NewPad2`)
      .expect(302)
      .expect("Location", `/p/${padID2}`);
    const res = await agent
      .get(getHTMLEndPointFor(padID1))
      .set("Authorization", await generateJWTToken());
    const html1Body = res.body.data.html;
    if (!html1Body.includes("#PAD2")) {
      throw new Error(`Hash should not be updated: ${html1Body}`);
    }
    await agent
      .put(`/ep_weave/hashes?oldtitle=PAD2&newtitle=NewPad2`)
      .expect(200);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const updatedRes = await agent
      .get(getHTMLEndPointFor(padID1))
      .set("Authorization", await generateJWTToken());
    const updatedHtml1Body = updatedRes.body.data.html;
    if (updatedHtml1Body.includes("#PAD2")) {
      throw new Error(`Hash should be updated: ${updatedHtml1Body}`);
    }
    if (!updatedHtml1Body.includes("#NewPad2")) {
      throw new Error(`Hash should be updated: ${updatedHtml1Body}`);
    }
  });

  it("can access via title with space", async function () {
    const html1WithSpace = () => buildHTML("<p>TEST PAD</p><p>Hello World</p>");
    await setHTML(padID1, html1WithSpace());
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await agent
      .get(`/t/TEST%20PAD`)
      .expect(302)
      .expect("Location", `/p/${padID1}`);
  });
});
