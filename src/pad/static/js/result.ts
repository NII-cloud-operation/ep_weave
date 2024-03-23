import { PadType } from "ep_search/setup";

export function query(query: string, sort?: string): Promise<PadType[]> {
  return new Promise((resolve, reject) => {
    let sortOption = "";
    if (sort) {
      sortOption = `&sort=${encodeURIComponent(sort.toString())}`;
    }
    $.getJSON(
      `/search/?query=${encodeURIComponent(query)}${sortOption}`,
      (data: PadType[]) => {
        resolve(data);
      }
    ).fail((err) => {
      reject(err);
    });
  });
}
