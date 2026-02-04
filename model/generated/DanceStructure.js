export class DanceStructure {
    constructor({ rows, columns }) {
        if (rows <= 0) {
            throw new Error("Number of rows must be a positive number greater than zero");
        }
        if (columns <= 0) {
            throw new Error("Number of columns must be a positive number greater than zero");
        }
        this.rows = rows;
        this.columns = columns;
    }
}
