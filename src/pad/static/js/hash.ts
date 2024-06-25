import { escapeForText } from "./result";

export function getHashQuery(hash: string) {
  const hashText = hash.startsWith("#") ? hash : `#${hash}`;
  return `hash:"${escapeForText(hashText)}"`;
}
