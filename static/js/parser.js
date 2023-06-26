'use strict';

function removeMd(text) {
  const m = text.match(/^\*+(.+)$/);
  if (m) {
    return m[1];
  }
  return text;
}

function tokenize(text) {
  const found = text.search(/\#\S+/);
  if (found < 0) {
    return text;
  }
  if (found > 0) {
    return text.substring(0, found);
  }
  const m = text.match(/(\#\S+).*/);
  return m[1];
}

exports.tokenize = tokenize;

exports.parse = (text) => {
  if (!text.includes('\n')) {
    return {
      title: removeMd(text),
      hashes: [],
    };
  }
  const pos = text.indexOf('\n');
  const title = removeMd(text.substring(0, pos));
  text = text.substring(pos + 1);
  const hashes = [];
  while (text.length > 0) {
    const token = tokenize(text);
    if (token.match(/^\#.+/)) {
      hashes.push(token);
    }
    text = text.substring(token.length);
  }
  return {title, hashes};
};
