function removeMd(text: string) {
  const m = text.match(/^\*+(.+)$/);
  if (m) {
    return m[1];
  }
  return text;
}

export function tokenize(text: string) {
  const found = text.search(/\#[^#\s]+/);
  if (found < 0) {
    return text;
  }
  if (found > 0) {
    return text.substring(0, found);
  }
  const m = text.match(/(\#[^#\s]+).*/);
  if (m === null) {
    throw new Error('Unexpected error');
  }
  return m[1];
}

export function parse(text: string) {
  if (!text.includes('\n')) {
    return {
      title: removeMd(text),
      hashes: [],
    };
  }
  const pos = text.indexOf('\n');
  const title = removeMd(text.substring(0, pos));
  text = text.substring(pos + 1);
  const hashes: string[] = [];
  while (text.length > 0) {
    const token = tokenize(text);
    if (token.match(/^\#.+/)) {
      hashes.push(token);
    }
    text = text.substring(token.length);
  }
  return {title, hashes};
};
