declare module "ep_etherpad-lite/static/js/pad_cookie" {
  export const padcookie: {
    getPref(name: string): unknown;
    setPref(name: string, value: unknown): void;
  };
}
