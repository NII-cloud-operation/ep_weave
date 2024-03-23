declare module "ep_search/setup" {
  export type Revision = {
    timestamp: number;
  };

  export type PadType = {
    id: string;
    apool: () => APool;
    atext: AText;
    pool: APool;
    getInternalRevisionAText: (text: number | string) => Promise<AText>;
    getValidRevisionRange: (fromRev: string, toRev: string) => PadRange;
    getRevisionAuthor: (rev: number) => Promise<string>;
    getRevision: (rev?: string) => Promise<any>;
    head: number;
    getAllAuthorColors: () => Promise<MapArrayType<string>>;
    remove: () => Promise<void>;
    text: () => string;
    setText: (text: string, authorId?: string) => Promise<void>;
    appendText: (text: string) => Promise<void>;
    getHeadRevisionNumber: () => number;
    getRevisionDate: (rev: number) => Promise<number>;
    getRevisionChangeset: (rev: number) => Promise<AChangeSet>;
    appendRevision: (changeset: AChangeSet, author: string) => Promise<void>;
    savedRevisions: Array<Revision>;
    title: string;
    indexed: number;
    shorttext?: string;
  };

  export type SearchEngine = {
    search(query: string): Promise<PadType[]>;
  };

  export function createSearchEngine(query: string): SearchEngine;
}
