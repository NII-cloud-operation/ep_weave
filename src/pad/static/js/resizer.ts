let isResizing = false,
  lastY = 0;

export function windowResized() {
  const editbarHeight = $("#editbar").outerHeight(true);
  const hashviewcontainerHeight = $("#hashview-container").outerHeight(true);
  const windowHeight = $(window).height();

  if (
    editbarHeight === undefined ||
    hashviewcontainerHeight === undefined ||
    windowHeight === undefined
  ) {
    console.warn(
      "Failed to get height of editbar, hashviewcontainer, or window."
    );
    return;
  }

  var newEditorContainerHeight =
    windowHeight - (editbarHeight + hashviewcontainerHeight);
  $("#editorcontainer").height(newEditorContainerHeight);
}

function attachResizeHandlers(resizeHandle: JQuery) {
  const resizeOverlay = $("<div>").css({
    position: "absolute",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
  });
  resizeOverlay.hide().appendTo("body");

  resizeHandle.on("mousedown", (event) => {
    event.preventDefault();
    isResizing = true;
    lastY = event.clientY;
    resizeOverlay.show();
  });

  $(document).on("mousemove", (event) => {
    if (!isResizing) {
      return;
    }
    const target = $("#hashview-container");
    const height = target.height();
    if (height === undefined) {
      console.warn("Failed to get height of hashview-container.");
      return;
    }
    const newY = event.clientY;
    const delta = newY - lastY;
    const newHeight = height - delta;
    target.css("height", `${newHeight}px`);
    lastY = newY;
    windowResized();
  });

  $(document).on("mouseup", () => {
    isResizing = false;
    resizeOverlay.hide();
  });
}

export function initResizer(resizeHandle: JQuery) {
  attachResizeHandlers(resizeHandle);

  $(window).on("resize", windowResized);
  setTimeout(windowResized, 100);
}
