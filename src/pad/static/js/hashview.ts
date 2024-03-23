import {
  AceEditEventContext,
  AceGetFilterStackContext,
  AceToolbar,
  ClientVars,
  PostAceInitContext,
  PostToolbarInit,
} from "ep_etherpad-lite/hooks";
import { parse } from "./parser";
import { PadType } from "ep_search/setup";
import { query } from "./result";

type PadRef = {
  id: string;
};

const logPrefix = "[ep_weave/hashview]";
let currentHashes: string[] = [];
let myPad: PadRef | null = null;
let duplicatedPads: PadRef[] | null = null;
let changedTitle: { oldtitle: string; newtitle: string } | null = null;
const ACE_EDITOR_TAG = "searchHash";
const ACE_EDITOR_MODIFIER_PATTERN = /(^| )searchHash:(\S+)/g;
const ACE_EDITOR_CLASS = "hashview-editor-link";
const MAX_OPEN_DUPLICATED_PADS = 3;

function updateTitle(title: string) {
  document.title = `${title} | Etherpad`;
}

function getPadURL() {
  const { ep_weave } = clientVars;
  if (!ep_weave) {
    throw new Error("Not initialized");
  }
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.pathname = `/t/${encodeURIComponent(ep_weave.title)}`;
  return url.toString();
}

function overrideEmbedCommand(toolbar: AceToolbar) {
  function setEmbedLinks() {
    // Modified: https://github.com/ether/etherpad-lite/blob/fa08e904066a9ca227a831776a15b9cb642b4304/src/static/js/pad_editbar.js#L263
    const params =
      "?showControls=true&showChat=true&showLineNumbers=true&useMonospaceFont=false";
    const props = 'width="100%" height="600" frameborder="0"';

    if ($("#readonlyinput").is(":checked")) {
      const padUrl = window.location.href.split("?")[0];
      const urlParts = padUrl.split("/");
      urlParts.pop();
      const readonlyLink = `${urlParts.join("/")}/${clientVars.readOnlyId}`;
      $("#embedinput").val(
        `<iframe name="embed_readonly" src="${readonlyLink}${params}" ${props}></iframe>`
      );
      $("#linkinput").val(readonlyLink);
    } else {
      const padUrl = getPadURL();
      $("#embedinput").val(
        `<iframe name="embed_readwrite" src="${padUrl}${params}" ${props}></iframe>`
      );
      $("#linkinput").val(padUrl);
    }
  }
  toolbar.registerCommand("embed", () => {
    setEmbedLinks();
    toolbar.toggleDropDown("embed");
    $("#linkinput").focus().select();
  });
}

function createMenuItem() {
  const changeTitleButton = $("<button></button>")
    .addClass("hashview-change-title btn")
    .click(() => {
      if (!changedTitle) {
        return;
      }
      $.ajax({
        url: `/ep_weave/hashes?${new URLSearchParams({
          oldtitle: changedTitle.oldtitle,
          newtitle: changedTitle.newtitle,
        })}`,
        type: "PUT",
        dataType: "json",
        success: (data) => {
          const { ep_weave } = clientVars;
          console.debug(logPrefix, "Result", data);
          $(".hashview-change-title").hide();
          if (!changedTitle) {
            console.warn(
              logPrefix,
              "Unexpected state: changedTitle=",
              changedTitle
            );
            return;
          }
          ep_weave.oldTitle = changedTitle.newtitle;
          changedTitle = null;
          if (!currentHashes) {
            return;
          }
          reloadHashView(ep_weave.title, currentHashes);
        },
      });
    });
  const titleDuplicatedLabel = $("<button></button>")
    .addClass("hashview-title-duplicated btn")
    .click(() => {
      if (!duplicatedPads) {
        return;
      }
      duplicatedPads.forEach((pad) => {
        console.debug(logPrefix, "Open pad", pad);
        window.open(`/p/${pad.id}`, "_blank");
      });
    });
  return $("<li></li>")
    .attr("id", "ep_weave_toolbar")
    .append(changeTitleButton)
    .append(titleDuplicatedLabel);
}

function checkTitleChanged(title: string) {
  const { ep_weave } = clientVars;
  if (ep_weave.titleChangedChecked === title) {
    return;
  }
  const qhash = `hash:"#${ep_weave.oldTitle}"`;
  $.getJSON(`/search/?query=${encodeURIComponent(qhash)}`, (data) => {
    if (!data || data.length === 0) {
      console.debug(logPrefix, "Not referred", data);
      return;
    }
    console.debug(logPrefix, "Referred", data.length);
    changedTitle = {
      oldtitle: ep_weave.oldTitle,
      newtitle: title,
    };
    $(".hashview-change-title").text(`Title changed: ${title}`).show();
    ep_weave.titleChangedChecked = title;
  });
}

function checkTitleDuplicated(title: string, customClientVars?: ClientVars) {
  const { ep_weave } = customClientVars || clientVars;
  if (ep_weave.titleDuplicatedChecked === title) {
    return;
  }
  const qhashNew = `title:${title}`;
  $.getJSON(
    `/search/?query=${encodeURIComponent(qhashNew)}`,
    (data: PadType[]) => {
      ep_weave.titleDuplicatedChecked = title;
      const filtered = (data || []).filter(
        (elem) => elem.id !== myPad?.id && elem.title === title
      );
      if (filtered.length === 0) {
        $(".hashview-title-duplicated").hide();
        return;
      }
      console.debug(logPrefix, "Duplicated", filtered.length);
      duplicatedPads = filtered
        .sort((a, b) => {
          if (a.indexed > b.indexed) {
            return -1;
          }
          if (a.indexed < b.indexed) {
            return 1;
          }
          return 0;
        })
        .slice(0, MAX_OPEN_DUPLICATED_PADS);
      $(".hashview-title-duplicated").text(`Title duplicated: ${title}`).show();
      $(".hashview-change-title").hide();
    }
  );
}

function checkTitle(title: string) {
  const { ep_weave } = clientVars;
  if (ep_weave && ep_weave.oldTitle === title) {
    $(".hashview-change-title").hide();
  } else {
    checkTitleChanged(title);
  }
  checkTitleDuplicated(title);
}

async function loadHashView(
  title: string,
  hash: string,
  sort: string | undefined,
  container: JQuery
) {
  const dataForHash: PadType[] = await query(`hash:"${hash}"`, sort);
  let empty = true;
  (dataForHash || [])
    .filter((doc) => doc.id !== clientVars.padId)
    .forEach((doc) => {
      let value = doc.id;
      value = value.replace("pad:", "");
      value = encodeURIComponent(value);
      const title = doc.title || value;
      const anchor = $("<a></a>").attr("href", `/p/${value}`).text(title);
      const hashLink = $("<div></div>")
        .append($("<div></div>").addClass("hash-title").append(anchor))
        .addClass("hash-link");
      if (doc.shorttext) {
        hashLink.append(
          $("<div></div>").addClass("hash-shorttext").append(doc.shorttext)
        );
      }
      container.append(hashLink);
      empty = false;
    });
  if (
    (dataForHash || []).every((doc) => doc.title !== hash.substring(1)) &&
    title !== hash.substring(1)
  ) {
    const dataForTitle: PadType[] = await query(
      `title:${hash.substring(1)}`,
      sort
    );
    const anchor = $("<a></a>")
      .attr("href", `/t/${hash.substring(1)}`)
      .text(hash.substring(1));
    const createClass = (dataForTitle || []).length === 0 ? "hash-create" : "";
    const hashLink = $("<div></div>")
      .append($("<div></div>").addClass("hash-title").append(anchor))
      .addClass(`hash-link ${createClass}`);
    if ((dataForTitle || []).length > 0 && dataForTitle[0].shorttext) {
      hashLink.append(
        $("<div></div>")
          .addClass("hash-shorttext")
          .append(dataForTitle[0].shorttext)
      );
    }
    container.append(hashLink);
    empty = false;
  }
  if (empty) {
    container.append($("<div></div>").text("No related pages"));
  }
  return !empty;
}

function reloadHashView(title: string, hashes: string[]) {
  const root = $("#hashview").empty();
  const tasks = (hashes || []).map((hash) => {
    root.append($("<div></div>").text(hash).addClass("hash-text"));
    const container = $("<div></div>").addClass("hash-container");
    root.append(container);
    const sort = $("#hashview-order").val();
    return loadHashView(
      title,
      hash,
      sort !== undefined ? sort.toString() : undefined,
      container
    );
  });
  Promise.all(tasks).then(() => {
  });
}

exports.postAceInit = (hook: any, context: PostAceInitContext) => {
  const { ace, pad, clientVars } = context;
  myPad = {
    id: pad.getPadId(),
  };
  console.debug(logPrefix, "AceEditor", ace);
  const text = ace.exportText();
  const { title } = parse(text || "");
  clientVars.ep_weave = {
    title,
    oldTitle: title,
  };
  updateTitle(title);
  checkTitleDuplicated(title, clientVars);
};

exports.aceEditEvent = (hook: string, context: AceEditEventContext) => {
  if ($("#hashview").length === 0) {
    return;
  }
  if (!clientVars || !clientVars.ep_weave) {
    // Not initialized yet.
    return;
  }
  const { ep_weave } = clientVars;
  let { title, hashes } = parse((context.rep || {}).alltext || "");
  if (title || myPad) {
    const myHash = `#${title || myPad?.id}`;
    hashes = [myHash].concat(hashes.filter((h) => h !== myHash));
  }
  if (ep_weave.title !== title) {
    console.debug(logPrefix, "Title changed", ep_weave.title, title);
    ep_weave.title = title;
    ep_weave.titleChangedChecked = null;
    ep_weave.titleDuplicatedChecked = null;
    updateTitle(title);
    checkTitle(title);
  }
  if (
    currentHashes.length === hashes.length &&
    currentHashes.every((val, index) => val === hashes[index])
  ) {
    // No changes
    return;
  }
  currentHashes = hashes;
  console.debug(logPrefix, "EDITED", hashes);
  reloadHashView(title, hashes);
};

exports.postToolbarInit = (hook: any, context: PostToolbarInit) => {
  const $editorcontainerbox = $("#editorcontainerbox");
  const result = $("<div>").attr("id", "hashview");
  const close = $("<div>")
    .addClass("hashview-close")
    .append($("<i>").addClass("buttonicon buttonicon-times"))
    .click((event) => {
      event.stopPropagation();
      const collapsed = $(".hashview-collapsed");
      if (collapsed.length === 0) {
        $(".hashview")
          .addClass("hashview-collapsed")
          .removeClass("hashview-expanded");
      }
    });
  const sortSelection = $("<select></select>")
    .attr("id", "hashview-order")
    .append(
      $("<optgroup></optgroup>")
        .attr("label", "Sort by")
        .append(
          $("<option></option>")
            .attr("value", "indexed desc")
            .attr("selected", "selected")
            .text("Date modified")
        )
        .append(
          $("<option></option>")
            .attr("value", "created desc")
            .text("Date created")
        )
        .append($("<option></option>").attr("value", "title asc").text("Title"))
    );
  const sort = $("<div>")
    .addClass("hashview-sort")
    .append(
      sortSelection.on("change", () => {
        if (!clientVars) {
          return;
        }
        const { ep_weave } = clientVars;
        if (!currentHashes) {
          return;
        }
        reloadHashView(ep_weave.title, currentHashes);
      })
    );
  $("<div>")
    .addClass("hashview hashview-expanded")
    .append(
      $("<div></div>").addClass("hashview-toolbar").append(sort).append(close)
    )
    .append(result)
    .click(() => {
      const collapsed = $(".hashview-collapsed");
      if (collapsed.length > 0) {
        $(".hashview")
          .removeClass("hashview-collapsed")
          .addClass("hashview-expanded");
      }
    })
    .appendTo($editorcontainerbox);
  /*
  window.hvSelectHash = (selectedHash) => {
    console.debug(logPrefix, "CLICKED", selectedHash);
    const collapsed = $(".hashview-collapsed");
    if (collapsed.length > 0) {
      $(".hashview")
        .removeClass("hashview-collapsed")
        .addClass("hashview-expanded");
    }
  };
  */
  const { toolbar } = context;
  overrideEmbedCommand(toolbar);
  $("#editbar > .menu_right").prepend(createMenuItem());
  const { ep_weave } = clientVars;
  if (!ep_weave) {
    return;
  }
  checkTitleDuplicated(ep_weave.title, clientVars);
};

exports.aceGetFilterStack = (hook: any, context: AceGetFilterStackContext) => {
  const { linestylefilter } = context;
  return [
    linestylefilter.getRegexpFilter(/\#\S+/g, ACE_EDITOR_TAG),
    linestylefilter.getRegexpFilter(/\[\[\S+\]\]/g, ACE_EDITOR_TAG),
  ];
};

export function aceCreateDomLine(
  hook: any,
  context: {
    cls: string;
    domline: string;
    rep: {
      alltext: string;
    };
  }
) {
  const { domline, cls } = context;
  if (cls.indexOf(ACE_EDITOR_TAG) < 0) {
    return;
  }
  let searchHash: string | null = null;
  const modifiedCls = cls.replace(
    ACE_EDITOR_MODIFIER_PATTERN,
    (x0, space, hash: string) => {
      searchHash = hash;
      return space + ACE_EDITOR_CLASS;
    }
  );
  if (!searchHash) {
    return;
  }
  const searchHash_ = searchHash as string;
  const hash = searchHash_.match(/^#(\S+)/);
  const link = searchHash_.match(/^\[\[(\S+)\]\]/);
  if (!hash && !link) {
    throw new Error(`Unexpected error: ${searchHash_}, ${hash}, ${link}`);
  }
  const hashTitle = hash ? hash?.[1] : link?.[1];
  if (!hashTitle) {
    throw new Error(`Unexpected error: ${searchHash_}, ${hash}, ${link}`);
  }
  return [
    {
      extraOpenTags: `<a href="/t/${encodeURIComponent(hashTitle)}">`,
      extraCloseTags: "</a>",
      cls: modifiedCls,
    },
  ];
}
