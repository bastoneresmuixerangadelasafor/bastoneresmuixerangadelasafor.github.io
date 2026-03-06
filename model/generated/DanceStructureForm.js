export class DanceStructureForm {
    constructor(value) {
        if (!value || value.trim().length === 0) {
            throw new Error('DanceStructureForm must be a non-empty string');
        }
        const formatted = value.trim().toLowerCase();
        if (formatted !== DanceStructureForm.GRID && formatted !== DanceStructureForm.RADIAL) {
            throw new Error("DanceStructureForm must be either 'grid' or 'radial'");
        }
        this._value = formatted;
    }
    toString() {
        return this._value;
    }
    get value() {
        return this._value;
    }
    toJSON() {
        return this._value;
    }
}
DanceStructureForm.GRID = 'grid';
DanceStructureForm.RADIAL = 'radial';
