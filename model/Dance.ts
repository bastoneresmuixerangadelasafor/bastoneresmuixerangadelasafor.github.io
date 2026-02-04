import { DanceDiagram } from "./DanceDiagram.js";
import { DanceMusic } from "./DanceMusic.js";
import { DancePosition } from "./DancePosition.js";
import { DanceStructure } from "./DanceStructure.js";

interface DanceParams {
  name: string;
  minGroups: number;
  structure: DanceStructure;
  diagram: DanceDiagram;
  positions?: DancePosition[];
  audios?: DanceMusic[];
}

export class Dance {
  readonly name: string;
  readonly minGroups: number;
  readonly structure: DanceStructure;
  readonly diagram: DanceDiagram;
  readonly positions: DancePosition[];
  readonly audios: DanceMusic[];

  constructor({
    name,
    minGroups,
    structure,
    diagram,
    positions = [],
    audios = [],
  }: DanceParams) {
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
