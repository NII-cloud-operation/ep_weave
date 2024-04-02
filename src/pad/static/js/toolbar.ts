export type Callbacks = {
  onSearch: (query: string) => void;
  onSort: (sort: string) => void;
};

export function createCloseButton(onClose: () => void) {
  const close = $("<div>")
    .addClass("hashview-close")
    .append($("<i>").addClass("buttonicon buttonicon-times"))
    .on("click", (event) => {
      event.stopPropagation();
      onClose();
    });
  return close;
}

function createSortSelection(onSort: (sort: string) => void) {
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
        const sort = sortSelection.val();
        if (typeof sort !== "string") {
          return;
        }
        onSort(sort);
      })
    );
  return sort;
}

function createSearchBox(onSearch: (query: string) => void) {
  const searchBox = $("<input>")
    .addClass("hashview-search-box")
    .attr("type", "search")
    .attr("placeholder", "Search")
    .on("keyup", (event) => {
      if (event.which !== 13) {
        return;
      }
      const query = searchBox.val();
      if (typeof query !== "string") {
        return;
      }
      onSearch(query);
    });
  const searchButton = $("<button>").append("Search");
  searchButton.on("click", (event) => {
    const query = searchBox.val();
    if (typeof query !== "string") {
      return;
    }
    onSearch(query);
  });
  const createButton = $("<button>")
    .append("Create")
    .attr("disabled", "disabled");
  createButton.on("click", (event) => {
    const query = searchBox.val();
    if (typeof query !== "string") {
      return;
    }
    window.open(`/t/${encodeURIComponent(query)}`, "_blank");
  });
  searchBox.on("input", () => {
    const query = searchBox.val();
    createButton.attr("disabled", query === "" ? "disabled" : null);
  });
  return $("<div>")
    .addClass("hashview-search")
    .append(searchBox)
    .append(searchButton)
    .append(createButton);
}

export function createToolbar(callbacks: Callbacks) {
  const searchBox = createSearchBox(callbacks.onSearch);
  const sort = createSortSelection(callbacks.onSort);
  const toolbar = $("<div></div>")
    .addClass("hashview-toolbar")
    .append(searchBox)
    .append(sort);
  return toolbar;
}
