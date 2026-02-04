export class MemberName {
    constructor(value) {
        if (!value || value.trim().length === 0) {
            throw new Error('Name must be a non-empty string');
        }
        this._value = value;
    }
    toString() {
        return this._value;
    }
    get value() {
        return this._value;
    }
}
