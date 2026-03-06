export class DanceStructureForm {
  private readonly _value: string;

  static readonly GRID = 'grid';
  static readonly RADIAL = 'radial';

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('DanceStructureForm must be a non-empty string');
    }
    const formatted = value.trim().toLowerCase();
    if (formatted !== DanceStructureForm.GRID && formatted !== DanceStructureForm.RADIAL) {
      throw new Error("DanceStructureForm must be either 'grid' or 'radial'");
    }
    this._value = formatted;
  }

  toString(): string {
    return this._value;
  }

  get value(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }
}

