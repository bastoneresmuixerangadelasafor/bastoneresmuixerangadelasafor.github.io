export class Role {
    constructor(value) {
        if (!value || value.trim().length === 0) {
            throw new Error('Role must be a non-empty string');
        }
        if (value !== Role.ADMIN) {
            throw new Error(`Invalid role: ${value}`);
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
Role.ADMIN = 'ADMIN';
