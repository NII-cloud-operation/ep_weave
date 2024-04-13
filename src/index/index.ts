import { createHashItemView } from "../pad/static/js/hashitem";
import { query } from "../pad/static/js/result";
import { createToolbar } from "../pad/static/js/toolbar";

const LIMIT_ITEMS = 20;

async function updateIndex(
  container: JQuery,
  queryString?: string,
  start?: number,
  rows?: number,
  sort?: string
) {
  const result = await query(
    queryString || "*",
    start || 0,
    rows === undefined ? LIMIT_ITEMS : rows,
    sort
  );
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
          sort
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
  $("#weave-error-close").on("click", () => {
    closeErrorMessage();
  });
  $("#weave-index .weave-toolbar").append(
    createToolbar({
      onSort: (sort) => {
        updateIndex(rootContainer, undefined, 0, 5, sort)
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
        updateIndex(rootContainer, query)
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
    })
  );
  updateIndex(rootContainer)
    .then(() => {
      console.log("Index updated");
    })
    .catch((err) => {
      showErrorMessage(
        `Error retrieving index: ${err.stack || err.message || String(err)}`
      );
    });
}
