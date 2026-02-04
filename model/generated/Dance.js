export class Dance {
    constructor({ name, minGroups, structure, diagram, positions = [], audios = [], }) {
        if (!name || name.trim() === "") {
            throw new Error("Name cannot be an empty string");
        }
        if (!minGroups || minGroups <= 0) {
            throw new Error("minGroups must be a positive number greater than 0");
        }
        if (!structure) {
            throw new Error("Structure is required");
        }
        if (!diagram) {
            throw new Error("Diagram is required");
        }
        if (!positions || positions.length === 0) {
            throw new Error("Positions cannot be empty");
        }
        this.name = name;
        this.structure = structure;
        this.diagram = diagram;
        this.positions = positions;
        this.minGroups = minGroups;
        this.audios = audios;
    }
}
