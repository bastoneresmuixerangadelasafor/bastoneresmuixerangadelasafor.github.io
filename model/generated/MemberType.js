export class MemberType {
    constructor(value) {
        if (!value || value.trim().length === 0) {
            throw new Error('MemberType must be a non-empty string');
        }
        const formatted = value.trim();
        if (formatted !== MemberType.ADULT && formatted !== MemberType.KID) {
            throw new Error("MemberType must be either 'Adult' or 'Kid'");
        }
        this._value = formatted;
    }
    toString() {
        return this._value;
    }
    get value() {
        return this._value;
    }
}
MemberType.ADULT = 'ADULT';
MemberType.KID = 'KID';
