export class DanceVideo {
    constructor({ url, title }) {
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
