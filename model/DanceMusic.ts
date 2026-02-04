interface DanceMusicParams {
  fileId: string;
  title?: string;
  artist?: string;
}

export class DanceMusic {
  readonly fileId: string;
  readonly title: string;
  readonly artist: string;

  constructor({ fileId, title, artist }: DanceMusicParams) {
    if (!fileId || fileId.trim() === "") {
      throw new Error("FileId cannot be empty");
    }
    if (!title || title.trim() === "") {
      throw new Error("Title cannot be empty");
    }
    if (!artist || artist.trim() === "") {
      throw new Error("Artist cannot be empty");
    }
    this.fileId = fileId;
    this.title = title;
    this.artist = artist;
  }

  getFileId(): string {
    return this.fileId;
  }

  getTitle(): string {
    return this.title;
  }

  getArtist(): string {
    return this.artist;
  }

  toString(): string {
    return this.fileId.toString();
  }
}
