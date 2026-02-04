export class Email {
	private readonly _value: string;

	constructor(value: string) {
		this._value = Email.format(value);
		if (!Email.validate(this._value)) {
			throw new Error('Invalid email address');
		}
	}

	static validate(email: string): boolean {
		// Simple email regex for demonstration
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	static format(email: string): string {
		return email.trim().toLowerCase();
	}

	toString(): string {
		return this._value;
	}

	get value(): string {
		return this._value;
	}
}
