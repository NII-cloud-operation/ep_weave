import {
  AceEditEventContext,
  AceGetFilterStackContext,
  AceToolbar,
  ClientVars,
  PostAceInitContext,
  PostToolbarInit,
} from "ep_etherpad-lite/hooks";
import { createHashItemView } from "./hashitem";
import { parse } from "./parser";
import { query, escapeForText } from "./result";
import { createToolbar, createCloseButton } from "./toolbar";
import { initResizer, windowResized } from "./resizer";
import { getHashQuery } from "./hash";

type PadRef = {
  id: string;
};

type RelatedHash = {
  displayName: string;
  hash: string;
};

const logPrefix = "[ep_weave/hashview]";
let currentHashes: RelatedHash[] = [];
let currentSearchBox: string | null = null;
let myPad: PadRef | null = null;
let duplicatedPads: PadRef[] | null = null;
let changedTitle: { oldtitle: string; newtitle: string } | null = null;
const ACE_EDITOR_TAG = "searchHash";
const ACE_EDITOR_MODIFIER_PATTERN = /(^| )searchHash:(\S+)/g;
const ACE_EDITOR_CLASS = "hashview-editor-link";
const MAX_OPEN_DUPLICATED_PADS = 3;
const LIMIT_HASH_VIEW_ITEMS = 60;

function updateTitle(title: string) {
  document.title = `${title} | Etherpad`;
  refreshNavbar($("#hashview-navbar"), title);
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

function refreshNavbar(navbar: JQuery, title: string) {
  navbar.empty();
  navbar.append(
    $("<a>")
      .attr("href", "/")
      .text("Index")
      .addClass("hashview-path-segment hashview-path-index")
  );
  navbar.append($("<span>").addClass("hashview-path-separator").text("/"));
  const pathSegments = title.split("/");
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    const parentPath = pathSegments.slice(0, i + 1).join("/");
    navbar.append(
      $("<a>")
        .addClass("hashview-path-segment")
        .text(segment)
        .attr("href", `/t/${encodeURIComponent(parentPath)}`)
    );
    navbar.append($("<span>").addClass("hashview-path-separator").text("/"));
  }
  navbar.append(
    $("<span>")
      .addClass("hashview-path-segment")
      .text(pathSegments[pathSegments.length - 1])
  );
  navbar.append(
    createCloseButton(() => {
      const collapsed = $(".hashview-collapsed");
      if (collapsed.length === 0) {
        $(".hashview")
          .addClass("hashview-collapsed")
          .removeClass("hashview-expanded");
      }
      setTimeout(() => {
        windowResized();
      }, 100);
    })
  );
}

function getCurrentSort() {
  const sort = $("#hashview-order").val();
  return typeof sort === "string" ? sort : null;
}

function createMenuItem() {
  const changeTitleButton = $("<button></button>")
    .addClass("hashview-change-title btn")
    .on("click", () => {
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
          reloadHashView(
            ep_weave.title,
            currentHashes,
            currentSearchBox,
            getCurrentSort()
          );
        },
      });
    });
  const titleDuplicatedLabel = $("<button></button>")
    .addClass("hashview-title-duplicated btn")
    .on("click", () => {
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
  query(
    `${getHashQuery(ep_weave.oldTitle)} OR title:${escapeForText(
      ep_weave.oldTitle
    )}/*`
  )
    .then((response) => {
      const data = response.docs;
      if (!data || data.length === 0) {
        console.debug(logPrefix, "Not referred", data);
        return;
      }
      console.debug(logPrefix, "Referred", data.length);
      changedTitle = {
        oldtitle: ep_weave.oldTitle,
        newtitle: title,
      };
      $(".hashview-change-title")
        .text(`Title changed: ${title} from ${ep_weave.oldTitle}`)
        .show();
      ep_weave.titleChangedChecked = title;
    })
    .catch((err) => {
      console.error(logPrefix, "Error", err);
    });
}

function checkTitleDuplicated(title: string, customClientVars?: ClientVars) {
  const { ep_weave } = customClientVars || clientVars;
  if (ep_weave.titleDuplicatedChecked === title) {
    return;
  }
  query(`title:"${escapeForText(title)}"`)
    .then((data) => {
      ep_weave.titleDuplicatedChecked = title;
      const filtered = (data.docs || []).filter(
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
      changedTitle = null;
    })
    .catch((err) => {
      console.error(logPrefix, "Error", err);
    });
}

function checkTitle(title: string) {
  const { ep_weave } = clientVars;
  if (ep_weave && ep_weave.oldTitle === title) {
    $(".hashview-change-title").hide();
    changedTitle = null;
  } else {
    checkTitleChanged(title);
  }
  checkTitleDuplicated(title);
}

async function loadChildPads(
  title: string,
  additionalQuery: string | null,
  limit: number,
  sort: string | undefined,
  container: JQuery
) {
  if (title.trim().length === 0) {
    container.append($("<div></div>").text("No related pages"));
    return false;
  }
  const additionalLuceneQuery = additionalQuery
    ? ` AND ${additionalQuery}`
    : "";
  const luceneQuery = `title:${escapeForText(
    `${title}/`
  )}*${additionalLuceneQuery}`;
  const { docs } = await query(luceneQuery, 0, limit, sort);
  let empty = true;
  const hashViews: Promise<JQuery>[] = [];
  (docs || [])
    .filter((doc) => doc.id !== clientVars.padId)
    .forEach((doc) => {
      hashViews.push(createHashItemView(doc));
      empty = false;
    });
  (await Promise.all(hashViews)).forEach((hashView) => {
    container.append(hashView);
  });
  if (empty) {
    container.append($("<div></div>").text("No related pages"));
  }
  return !empty;
}

async function loadHashView(
  title: string,
  hash: string,
  additionalQuery: string | null,
  limit: number,
  sort: string | undefined,
  container: JQuery
) {
  const additionalLuceneQuery = additionalQuery
    ? ` AND ${additionalQuery}`
    : "";
  const luceneQuery =
    title === hash.substring(1)
      ? getHashQuery(hash)
      : `(${getHashQuery(hash)} OR title:"${escapeForText(
          hash.substring(1)
        )}")`;
  const { docs } = await query(
    `${luceneQuery}${additionalLuceneQuery}`,
    0,
    limit,
    sort
  );
  let empty = true;
  const hashViews: Promise<JQuery>[] = [];
  (docs || [])
    .filter((doc) => doc.id !== clientVars.padId)
    .forEach((doc) => {
      hashViews.push(createHashItemView(doc));
      empty = false;
    });
  (await Promise.all(hashViews)).forEach((hashView) => {
    container.append(hashView);
  });
  const titledPadExists = docs.some((doc) => doc.title === hash.substring(1));
  if (title !== hash.substring(1) && !titledPadExists) {
    const anchor = $("<a></a>")
      .attr("href", `/t/${hash.substring(1)}`)
      .text(hash.substring(1));
    const createClass = "hash-create";
    const hashLink = $("<div></div>")
      .append($("<div></div>").addClass("hash-title").append(anchor))
      .addClass(`hash-link ${createClass}`);
    container.append(hashLink);
    empty = false;
  }
  if (empty) {
    container.append($("<div></div>").text("No related pages"));
  }
  return !empty;
}

function reloadHashView(
  title: string,
  hashes: RelatedHash[],
  additionalQuery: string | null,
  sort: string | null
) {
  const root = $("#hashview").empty();
  root.append($("<div></div>").text("Child pages").addClass("hash-text"));
  const childContainer = $("<div></div>").addClass("hash-container");
  root.append(childContainer);
  loadChildPads(
    title,
    additionalQuery,
    LIMIT_HASH_VIEW_ITEMS,
    sort || undefined,
    childContainer
  );

  const tasks = (hashes || []).map(({ displayName, hash }) => {
    root.append($("<div></div>").text(displayName).addClass("hash-text"));
    const container = $("<div></div>").addClass("hash-container");
    root.append(container);
    return loadHashView(
      title,
      hash,
      additionalQuery,
      LIMIT_HASH_VIEW_ITEMS,
      sort || undefined,
      container
    );
  });
  Promise.all(tasks).then(() => {});
}

function addBeforeUnloadListener() {
  $(window).on("beforeunload", (event) => {
    if (!changedTitle) {
      return undefined;
    }
    if (changedTitle.oldtitle === changedTitle.newtitle) {
      return undefined;
    }
    event.preventDefault();
    return "Title has been changed. Are you sure to leave?";
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
  addBeforeUnloadListener();
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
  let relatedHashes: RelatedHash[] = hashes.map((hash) => ({
    displayName: hash,
    hash,
  }));
  if (title || myPad) {
    const myHash = `#${title || myPad?.id}`;
    relatedHashes = [
      {
        displayName: "Pages referring to this page",
        hash: myHash,
      },
    ].concat(relatedHashes.filter(({ hash }) => hash !== myHash));
  }
  if (ep_weave.title !== title && title.length > 0) {
    console.debug(logPrefix, "Title changed", ep_weave.title, title);
    ep_weave.title = title;
    ep_weave.titleChangedChecked = null;
    ep_weave.titleDuplicatedChecked = null;
    updateTitle(title);
    checkTitle(title);
  }
  if (
    currentHashes.length === relatedHashes.length &&
    currentHashes.every((val, index) => val.hash === relatedHashes[index].hash)
  ) {
    // No changes
    return;
  }
  currentHashes = relatedHashes;
  console.debug(logPrefix, "EDITED", hashes);
  reloadHashView(title, relatedHashes, currentSearchBox, getCurrentSort());
};

exports.postToolbarInit = (hook: any, context: PostToolbarInit) => {
  const $editorcontainerbox = $("#editorcontainerbox");
  const result = $("<div>").attr("id", "hashview");
  const navbar = $("<div>").attr("id", "hashview-navbar");
  if (clientVars && clientVars.ep_weave && clientVars.ep_weave.title) {
    refreshNavbar(navbar, clientVars.ep_weave.title);
  }
  const handle = $("<div>").addClass("hashview-handle");
  $("<div>")
    .addClass("hashview hashview-expanded")
    .attr("id", "hashview-container")
    .append(handle)
    .append(navbar)
    .append(
      createToolbar({
        onSort: (sort: string) => {
          if (!clientVars) {
            return;
          }
          const { ep_weave } = clientVars;
          if (!currentHashes) {
            return;
          }
          reloadHashView(ep_weave.title, currentHashes, currentSearchBox, sort);
        },
        onSearch: (query: string) => {
          currentSearchBox = query;
          const { ep_weave } = clientVars;
          reloadHashView(
            ep_weave.title,
            currentHashes,
            query,
            getCurrentSort()
          );
        },
        onCreate: (query: string) => {
          const { ep_weave } = clientVars;
          if (!ep_weave) {
            throw new Error("Not initialized");
          }
          if (ep_weave.title === undefined) {
            throw new Error("Title is not set");
          }
          let { title } = ep_weave;
          if (!title.endsWith("/")) {
            title += "/";
          }
          title += query;
          window.open(`/t/${encodeURIComponent(title)}`, "_blank");
        },
      }).prepend($("<div>").text(">").addClass("hashview-toolbar-child-marker"))
    )
    .append(result)
    .on("click", () => {
      const collapsed = $(".hashview-collapsed");
      if (collapsed.length === 0) {
        return;
      }
      $(".hashview")
        .removeClass("hashview-collapsed")
        .addClass("hashview-expanded");
      setTimeout(() => {
        windowResized();
      }, 100);
    })
    .appendTo($editorcontainerbox);
  const { toolbar } = context;
  overrideEmbedCommand(toolbar);
  $("#editbar > .menu_right").prepend(createMenuItem());
  initResizer(handle);
  const { ep_weave } = clientVars;
  if (!ep_weave) {
    return;
  }
  checkTitleDuplicated(ep_weave.title, clientVars);
};

exports.aceGetFilterStack = (hook: any, context: AceGetFilterStackContext) => {
  const { linestylefilter } = context;
  return [
    linestylefilter.getRegexpFilter(/\#[^#\s]+/g, ACE_EDITOR_TAG),
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
