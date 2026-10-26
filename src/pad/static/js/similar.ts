import { AceRep } from "ep_etherpad-lite/hooks";
import { padcookie } from "ep_etherpad-lite/static/js/pad_cookie";
import { PadType } from "ep_search/setup";
import { createHashItemView } from "./hashitem";
import { getBasePath } from "./util";

const logPrefix = "[ep_weave/similar]";
const DEBOUNCE_MS = 500;
const INITIAL_ITEMS = 5;
const MAX_ITEMS = 20;
const PREF = "similarPages";

export type Selection =
  | { kind: "text"; text: string }
  | { kind: "image"; src: string };

let section: JQuery | null = null;
let status: JQuery;
let items: JQuery;
let worker: Worker | undefined;
let timer: number | undefined;
let suggested = "";
let enabled = true;
let latest = 0;
let chain: Promise<void> = Promise.resolve();

// The selected text, or the paragraph at the caret when nothing is selected;
// the first image in that range when it has no text.
export function selectedContent(rep: AceRep): Selection | null {
  const { selStart, selEnd } = rep;
  if (!selStart || !selEnd) {
    return null;
  }
  const collapsed = selStart[0] === selEnd[0] && selStart[1] === selEnd[1];
  const texts: string[] = [];
  let image: string | null = null;
  const last = Math.min(selEnd[0], rep.lines.length() - 1);
  for (let index = selStart[0]; index <= last; index++) {
    const line = rep.lines.atIndex(index);
    const start =
      !collapsed && index === selStart[0]
        ? Math.max(selStart[1], line.lineMarker)
        : line.lineMarker;
    const end = !collapsed && index === selEnd[0] ? selEnd[1] : line.text.length;
    texts.push(line.text.substring(start, end));
    const img = line.lineNode.querySelector("img");
    if (img && !image) {
      image = img.src;
    }
  }
  const text = texts.join("\n").trim();
  if (text) {
    return { kind: "text", text };
  }
  if (image) {
    return { kind: "image", src: image };
  }
  return null;
}

function embed(
  selection: Selection,
  progress: (message: string) => void
): Promise<number[]> {
  if (!worker) {
    worker = new Worker(
      `${getBasePath()}/static/plugins/ep_weave/static/js/embedding-worker.js`,
      { type: "module" }
    );
  }
  const current = worker;
  return new Promise((resolve, reject) => {
    const fail = (error: Error) => {
      current.terminate();
      worker = undefined;
      reject(error);
    };
    current.onmessage = ({ data }) => {
      if (data.progress) {
        progress(data.progress);
      } else if (data.error) {
        fail(new Error(data.error));
      } else {
        resolve(data.vector);
      }
    };
    current.onerror = (event) => {
      fail(new Error(event.message || "Could not load browser inference"));
    };
    current.postMessage(selection);
  });
}

async function search(vector: number[]): Promise<{ docs: PadType[] }> {
  const response = await fetch(
    `${getBasePath()}/ep_weave/similar?rows=${MAX_ITEMS}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vector }),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Similar search failed: ${response.status} ${await response.text()}`
    );
  }
  return await response.json();
}

async function append(docs: PadType[]) {
  const views = await Promise.all(docs.map(createHashItemView));
  views.forEach((view) => items.append(view));
}

async function render(docs: PadType[]) {
  const others = docs.filter((doc) => doc.id !== clientVars.padId);
  items.empty();
  if (others.length === 0) {
    items.append($("<div></div>").text("No similar pages"));
    return;
  }
  await append(others.slice(0, INITIAL_ITEMS));
  const rest = others.slice(INITIAL_ITEMS);
  if (rest.length === 0) {
    return;
  }
  const more = $("<a></a>")
    .attr("href", "#")
    .addClass("hash-more")
    .text("more…")
    .on("click", (event) => {
      event.preventDefault();
      more.remove();
      append(rest);
    });
  items.append(more);
}

function suggest(selection: Selection) {
  const sequence = ++latest;
  chain = chain
    .then(async () => {
      if (sequence !== latest) {
        return;
      }
      const vector = await embed(selection, (message) => status.text(message));
      if (sequence !== latest) {
        return;
      }
      status.text("Searching…");
      const { docs } = await search(vector);
      if (sequence !== latest) {
        return;
      }
      await render(docs);
      status.text("");
    })
    .catch((err) => {
      console.error(logPrefix, err);
      status.text(`Error: ${err.message}`);
    });
}

// Returns null when the browser cannot run the model.
export function createSimilarView(): JQuery | null {
  const checkbox = $("#options-similarpages");
  if (!("gpu" in navigator)) {
    console.info(logPrefix, "WebGPU is unavailable; similar pages are not suggested");
    checkbox.prop("disabled", true);
    return null;
  }
  status = $("<div></div>");
  items = $("<div></div>").addClass("hash-container");
  const view = $("<div></div>")
    .attr("id", "hashview-similar")
    .append($("<div></div>").text("Similar pages").addClass("hash-text"))
    .append(status)
    .append(items)
    .hide();
  enabled = padcookie.getPref(PREF) !== false;
  checkbox.prop("checked", enabled).on("change", () => {
    enabled = checkbox.prop("checked");
    padcookie.setPref(PREF, enabled);
    if (!enabled) {
      window.clearTimeout(timer);
      suggested = "";
      view.hide();
    }
  });
  section = view;
  return view;
}

export function selectionChanged(rep: AceRep) {
  const view = section;
  if (!view || !enabled) {
    return;
  }
  const selection = selectedContent(rep);
  if (!selection) {
    return;
  }
  const key = JSON.stringify(selection);
  if (key === suggested) {
    return;
  }
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    suggested = key;
    view.show();
    suggest(selection);
  }, DEBOUNCE_MS);
}
