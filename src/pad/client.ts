import { EejsBlockContext } from "ep_etherpad-lite/hooks";
import eejs from "ep_etherpad-lite/node/eejs";

exports.eejsBlock_styles = (hookName: any, context: EejsBlockContext) => {
  context.content += eejs.require("./templates/styles.html", {}, module);
};

exports.eejsBlock_indexWrapper = (
  hookName: any,
  context: EejsBlockContext,
  cb: () => void
) => {
  context.content += eejs.require("./templates/index.html", {}, module);
  return cb();
};

exports.eejsBlock_indexCustomScripts = (
  hookName: any,
  context: EejsBlockContext
) => {
  const script = eejs.require("./static/js/index.all.js", {}, module);
  context.content += `<script>${script}</script>`;
};
