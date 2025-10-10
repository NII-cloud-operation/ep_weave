import { createHashItemView } from "../pad/static/js/hashitem";
import { query } from "../pad/static/js/result";
import { createToolbar } from "../pad/static/js/toolbar";

const LIMIT_ITEMS = 60;

function updateURL(queryString?: string, sort?: string) {
  const url = new URL(window.location.href);
  
  // Use query parameters instead of path
  if (queryString && queryString !== "*") {
    url.searchParams.set("q", queryString);
  } else {
    url.searchParams.delete("q");
  }
  
  if (sort && sort !== "indexed desc") {
    url.searchParams.set("sort", sort);
  } else {
    url.searchParams.delete("sort");
  }
  
  window.history.replaceState({}, "", url.toString());
}

function getURLParams() {
  const url = new URL(window.location.href);
  
  return {
    query: url.searchParams.get("q") || undefined,
    sort: url.searchParams.get("sort") || undefined,
  };
}

async function updateIndex(
  container: JQuery,
  queryString?: string,
  start?: number,
  rows?: number,
  sort?: string,
  updateUrl: boolean = true
) {
  const result = await query(
    queryString || "*",
    start || 0,
    rows === undefined ? LIMIT_ITEMS : rows,
    sort
  );
  if (updateUrl && start === 0) {
    updateURL(queryString, sort);
  }
  container.empty();
  for (const hashView of await Promise.all(
    result.docs.map((doc) => createHashItemView(doc))
  )) {
    container.append(hashView);
  }
  if (result.numFound - result.start > result.docs.length) {
    const moreContainer = $("<div></div>").addClass(
      "weave-more-container weave-container"
    );
    const loadMore = $("<button></button>")
      .text("More...")
      .on("click", () => {
        updateIndex(
          moreContainer,
          queryString,
          result.start + result.docs.length,
          rows,
          sort,
          false
        )
          .then(() => {
            console.log("Index updated");
          })
          .catch((err) => {
            showErrorMessage(
              `Error retrieving index: ${
                err.stack || err.message || String(err)
              }`
            );
          });
      });
    moreContainer.append(loadMore);
    container.append(moreContainer);
  }
}

function showErrorMessage(message: string) {
  console.error(message);
  $("#weave-error-message").text(message);
  $("#weave-error").show();
}

function closeErrorMessage() {
  $("#weave-error").hide();
}

export default function init() {
  const rootContainer = $("#weave-index .weave-container");
  let urlParams = getURLParams();
  let currentQuery = urlParams.query;
  let currentSort = urlParams.sort || "indexed desc";
  
  $("#weave-error-close").on("click", () => {
    closeErrorMessage();
  });
  
  const toolbar = createToolbar({
    onSort: (sort) => {
      currentSort = sort;
      updateIndex(rootContainer, currentQuery, 0, LIMIT_ITEMS, sort)
        .then(() => {
          console.log("Index updated");
        })
        .catch((err) => {
          showErrorMessage(
            `Error retrieving index: ${
              err.stack || err.message || String(err)
            }`
          );
        });
    },
    onSearch: (query) => {
      currentQuery = query;
      updateIndex(rootContainer, query, 0, LIMIT_ITEMS, currentSort)
        .then(() => {
          console.log("Index updated");
        })
        .catch((err) => {
          showErrorMessage(
            `Error retrieving index: ${
              err.stack || err.message || String(err)
            }`
          );
        });
    },
  });
  
  $("#weave-index .weave-toolbar")
    .append($("<div>").text("ep_weave").addClass("weave-title"))
    .append(toolbar);
  
  // Initialize search box and sort selection from URL parameters
  if (urlParams.query) {
    toolbar.find(".hashview-search-box").val(urlParams.query);
    toolbar.find("button").last().attr("disabled", null);
  }
  if (urlParams.sort) {
    toolbar.find("#hashview-order").val(urlParams.sort);
  }
  
  updateIndex(rootContainer, urlParams.query, 0, LIMIT_ITEMS, urlParams.sort, false)
    .then(() => {
      console.log("Index updated");
    })
    .catch((err) => {
      showErrorMessage(
        `Error retrieving index: ${err.stack || err.message || String(err)}`
      );
    });
}
