export class PositionType {
    constructor({ label }) {
        if (!label || label.trim() === '') {
            throw new Error('Label cannot be empty');
        }
        this.label = label;
    }
}
