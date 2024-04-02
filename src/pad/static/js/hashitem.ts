import { PadType } from "ep_search/setup";

export function createHashItemView(doc: PadType) {
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
  return hashLink;
}
