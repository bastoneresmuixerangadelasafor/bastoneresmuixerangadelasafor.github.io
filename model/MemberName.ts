export class MemberName {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Name must be a non-empty string');
    }
    this._value = value;
  }

  toString(): string {
    return this._value;
  }

  get value(): string {
    return this._value;
  }
}
