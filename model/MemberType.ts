export class MemberType {
  private readonly _value: string;

  static readonly ADULT = 'ADULT';
  static readonly KID = 'KID';

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('MemberType must be a non-empty string');
    }
    const formatted = value.trim();
    if (formatted !== MemberType.ADULT && formatted !== MemberType.KID) {
      throw new Error("MemberType must be either 'Adult' or 'Kid'");
    }
    this._value = formatted;
  }

  toString(): string {
    return this._value;
  }

  get value(): string {
    return this._value;
  }
}
