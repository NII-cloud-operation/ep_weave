declare module "remove-markdown" {
  export default function removeMarkdown(
    markdown: string,
    options?: {
      stripListLeaders?: boolean;
      listUnicodeChar?: string;
      gfm: boolean;
      useImgAltText: boolean;
    }
  ): string;
}
