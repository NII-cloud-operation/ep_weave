"use strict";

import assert from "assert";
const common = require("ep_etherpad-lite/tests/backend/common");

let agent: any;
const apiVersion = 1;
const randomString =
  require("ep_etherpad-lite/static/js/pad_utils").randomString;
import { generateJWTToken } from "ep_etherpad-lite/tests/backend/common";

const SOLR_UPDATE_URL = "http://localhost:8983/solr/pad/update/json/docs?commit=true";
const INDEXING_WAIT = 30000;

const createPadWithHTML = async (padID: string, body: string) => {
  let res = await agent
    .get(`/api/${apiVersion}/createPad?padID=${padID}`)
    .set("Authorization", await generateJWTToken());
  if (res.body.code !== 0) {
    throw new Error("Unable to create new Pad");
  }
  const html = encodeURIComponent(`<html><body>${body}</body></html>`);
  res = await agent
    .get(`/api/${apiVersion}/setHTML?padID=${padID}&html=${html}`)
    .set("Authorization", await generateJWTToken());
  if (res.body.code !== 0) {
    throw new Error("Unable to set pad HTML");
  }
  return padID;
};

// Indexes a document the way a pre-upgrade ep_weave did: without a vector.
const indexWithoutVector = async (id: string, title: string, text: string) => {
  const now = new Date().toISOString();
  const atext = `${title}\n${text}`;
  const response = await fetch(SOLR_UPDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      indexed: now,
      created: now,
      _text_: atext,
      atext,
      title,
      hash: atext,
      shorttext: text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Solr update failed: ${response.status} ${await response.text()}`);
  }
};

const indexedVector = async (id: string) => {
  const response = await fetch(
    `http://localhost:8983/solr/pad/select?q=id:${id}&fl=embedding`
  );
  const { response: { docs } } = await response.json();
  return docs[0].embedding;
};

const related = async (pad: string) => {
  const res = await agent
    .get(
      `/ep_weave/related?query=${encodeURIComponent('hash:"#SIMILARITY"')}&pad=${pad}&rows=10`
    )
    .expect(200);
  return JSON.parse(res.text);
};

describe("related pads sorted by similarity", function () {
  let applePad: string;
  let tartPad: string;
  let clusterPad: string;
  let legacyPad: string;

  before(async function () {
    agent = await common.init();
    applePad = randomString(5);
    tartPad = randomString(5);
    clusterPad = randomString(5);
    legacyPad = randomString(5);
    await createPadWithHTML(
      applePad,
      "<p>Apple pie</p><p>Baking sliced apples with cinnamon in a butter pastry #SIMILARITY</p>"
    );
    await createPadWithHTML(
      tartPad,
      "<p>Fruit tart</p><p>A dessert of baked pastry filled with berries and custard #SIMILARITY</p>"
    );
    await createPadWithHTML(
      clusterPad,
      "<p>Kubernetes networking</p><p>Configuring cluster ingress controllers and service meshes #SIMILARITY</p>"
    );
    await new Promise((resolve) => setTimeout(resolve, INDEXING_WAIT));
    await indexWithoutVector(
      legacyPad,
      "Apple crumble",
      "Baked apples under a crumbly oat topping #SIMILARITY"
    );
  });

  it("orders pads by similarity to the given pad", async function () {
    const result = await related(applePad);
    assert.strictEqual(result.similarity, true);
    const ids = result.docs.map((doc: any) => doc.id);
    assert.deepStrictEqual(ids, [applePad, tartPad, clusterPad, legacyPad]);
  });

  it("lists pads without a vector last", async function () {
    const result = await related(tartPad);
    const ids = result.docs.map((doc: any) => doc.id);
    assert.strictEqual(ids[0], tartPad);
    assert.strictEqual(ids[ids.length - 1], legacyPad);
  });

  it("reports when the given pad has no vector", async function () {
    const result = await related(legacyPad);
    assert.strictEqual(result.similarity, false);
    assert.strictEqual(result.docs.length, 4);
  });

  it("lists the pads nearest to a given vector", async function () {
    const vector = await indexedVector(applePad);
    const res = await agent
      .post("/ep_weave/similar?rows=100")
      .send({ vector })
      .expect(200);
    const ids = JSON.parse(res.text).docs.map((doc: any) => doc.id);
    assert.strictEqual(ids[0], applePad);
    assert.ok(ids.indexOf(tartPad) < ids.indexOf(clusterPad));
    assert.ok(!ids.includes(legacyPad));
  });

  it("rejects a vector of the wrong dimension", async function () {
    await agent.post("/ep_weave/similar").send({ vector: [1, 2, 3] }).expect(400);
  });
});
