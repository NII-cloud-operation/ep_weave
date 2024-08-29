import { PadType } from "ep_search/setup";
import { getColorFromTitle, contrastRatio } from "./color";
import { getBasePath } from "./util";

function mostReadableColor(backgroundColor: string, colorCandidates: string[]) {
  const contrastRatios = colorCandidates.map((color) =>
    contrastRatio(backgroundColor, color)
  );
  const maxContrast = Math.max(...contrastRatios);
  return colorCandidates[contrastRatios.indexOf(maxContrast)];
}

export async function createHashItemView(doc: PadType) {
  let value = doc.id;
  value = value.replace("pad:", "");
  value = encodeURIComponent(value);
  const title = doc.title || value;
  const titleSegments = title.split("/");

  const backgroundColor = await getColorFromTitle(
    titleSegments[0],
    titleSegments.length - 1
  );
  const color = mostReadableColor(backgroundColor, [
    "#000000",
    "#cccccc",
    "#ffffff",
  ]);
  const basePath = getBasePath();
  const anchor = $("<a></a>")
    .attr("href", `${basePath}/p/${value}`)
    .css("color", color)
    .text(title);
  const hashLink = $("<div></div>")
    .css("background-color", backgroundColor)
    .append(
      $("<div></div>").addClass("hash-title").css("color", color).append(anchor)
    )
    .addClass("hash-link");
  if (doc.shorttext) {
    hashLink.append(
      $("<div></div>")
        .addClass("hash-shorttext")
        .css("color", color)
        .append(doc.shorttext)
    );
  }
  return hashLink;
}
