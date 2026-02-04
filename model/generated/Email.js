export class Email {
    constructor(value) {
        this._value = Email.format(value);
        if (!Email.validate(this._value)) {
            throw new Error('Invalid email address');
        }
    }
    static validate(email) {
        // Simple email regex for demonstration
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    static format(email) {
        return email.trim().toLowerCase();
    }
    toString() {
        return this._value;
    }
    get value() {
        return this._value;
    }
}
