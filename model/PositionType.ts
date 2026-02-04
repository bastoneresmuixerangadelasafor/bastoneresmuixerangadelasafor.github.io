interface PositionTypeParams {
  label: string;
}

export class PositionType {
  readonly label: string;

  constructor({ label }: PositionTypeParams) {
    if (!label || label.trim() === '') {
      throw new Error('Label cannot be empty');
    }
    this.label = label;
  }
}
