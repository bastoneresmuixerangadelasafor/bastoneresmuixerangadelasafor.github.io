interface DanceStructureParams {
  rows: number;
  columns: number;
}

export class DanceStructure {
  readonly rows: number;
  readonly columns: number;

  constructor({ rows, columns }: DanceStructureParams) {
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
