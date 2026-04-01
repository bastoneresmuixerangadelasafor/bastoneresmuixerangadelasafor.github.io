interface DanceVideoParams {
  url: string;
  title?: string;
}

export class DanceVideo {
  readonly url: string;
  readonly title: string;

  constructor({ url, title }: DanceVideoParams) {
    if (!url || url.trim() === "") {
      throw new Error("Url cannot be empty");
    }
    if (!title || title.trim() === "") {
      throw new Error("Title cannot be empty");
    }
    this.url = url;
    this.title = title;
  }
}
