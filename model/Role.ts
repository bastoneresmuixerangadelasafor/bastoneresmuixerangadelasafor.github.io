export class Role {
  static readonly ADMIN = 'ADMIN';
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Role must be a non-empty string');
    }
    if (value !== Role.ADMIN) {
      throw new Error(`Invalid role: ${value}`);
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
