import { DanceStructureForm } from './DanceStructureForm.js';

interface DanceStructureParams {
  rows: number;
  columns: number;
  forms: DanceStructureForm[];
}

export class DanceStructure {
  readonly rows: number;
  readonly columns: number;
  readonly forms: DanceStructureForm[];

  constructor({ rows, columns, forms }: DanceStructureParams) {
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
