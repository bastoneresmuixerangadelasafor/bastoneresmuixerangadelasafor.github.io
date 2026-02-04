export class DanceMusic {
    constructor({ fileId, title, artist }) {
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
    getFileId() {
        return this.fileId;
    }
    getTitle() {
        return this.title;
    }
    getArtist() {
        return this.artist;
    }
    toString() {
        return this.fileId.toString();
    }
}
