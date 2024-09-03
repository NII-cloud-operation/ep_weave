export function getBasePath() {
  // The path is in the form of .../p/id or .../t/title, so get the part before that
  const path = window.location.pathname;
  let index = path.indexOf("/p/");
  if (index < 0) {
    index = path.indexOf("/t/");
    if (index < 0) {
      console.warn("Base path not found", path);
      // remove the last part of the path
      const lastSlash = path.lastIndexOf("/");
      if (lastSlash >= 0) {
        return path.substring(0, lastSlash);
      } else {
        return "";
      }
    }
  }
  return path.substring(0, index);
}
