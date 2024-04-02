import { PadType } from "ep_search/setup";

export function createHashItemView(doc: PadType) {
  let value = doc.id;
  value = value.replace("pad:", "");
  value = encodeURIComponent(value);
  const title = doc.title || value;
  const titleSegments = title.split("/");
  const lastTitleSegment = titleSegments[titleSegments.length - 1];

  const anchor = $("<a></a>")
    .attr("href", `/p/${value}`)
    .text(lastTitleSegment);
  const hashLink = $("<div></div>")
    .append($("<div></div>").addClass("hash-title").append(anchor))
    .addClass("hash-link");
  if (doc.shorttext) {
    hashLink.append(
      $("<div></div>").addClass("hash-shorttext").append(doc.shorttext)
    );
  }
  return hashLink;
}
