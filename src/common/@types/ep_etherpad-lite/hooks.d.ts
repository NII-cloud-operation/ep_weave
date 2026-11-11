declare module "ep_etherpad-lite/hooks" {
  import { Request, Response, Express } from "express";
  import { PadType } from "ep_search/setup";

  export type AceEditor = any;

  export type Pad = PadType & {
    getPadId: () => string;
  };

  export type AceToolbar = {
    registerCommand: (command: string, handler: () => void) => void;
    toggleDropDown: (command: string) => void;
  };

  export type ClientVars = {
    ep_weave: {
      toggleRollupKey?: string;
      notebookSearchEnabled?: boolean;
      jupyterBaseUrl?: string;
      embeddingEnabled: boolean;
      title?: string;
      oldTitle?: string;
      titleChangedChecked?: any;
      titleDuplicatedChecked?: any;
    };
  };

  export type EejsBlockContext = {
    content: string;
  };

  export type PreAuthorizeArgs = {
    req: Request;
  };

  export type ExpressCreateServerArgs = {
    app: Express;
  };

  export type AceEditEventContext = {
    rep: {
      alltext: string;
    };
  };

  export type AceRep = {
    selStart: [number, number] | null;
    selEnd: [number, number] | null;
    lines: {
      length: () => number;
      atIndex: (index: number) => {
        text: string;
        lineMarker: number;
        lineNode: HTMLElement;
      };
    };
  };

  export type AceSelectionChangedContext = {
    rep: AceRep;
  };

  export type PostAceInitContext = {
    ace: AceEditor;
    pad: Pad;
    clientVars: ClientVars;
  };

  export type PostToolbarInit = {
    toolbar: AceToolbar;
  };

  export type AceGetFilterStackContext = {
    linestylefilter: {
      getRegexpFilter: (pattern: RegExp, tag: string) => any;
    };
  };
}
