export class DanceStructure {
    constructor({ rows, columns, forms }) {
        if (rows <= 0) {
            throw new Error("Number of rows must be a positive number greater than zero");
        }
        if (columns <= 0) {
            throw new Error("Number of columns must be a positive number greater than zero");
        }
        if (!Array.isArray(forms) || forms.length === 0) {
            throw new Error("Forms must be a non-empty array");
        }
        this.rows = rows;
        this.columns = columns;
        this.forms = forms;
    }
}
