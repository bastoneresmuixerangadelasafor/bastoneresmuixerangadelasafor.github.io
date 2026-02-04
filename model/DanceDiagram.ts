interface DanceDiagramParams {
	blockName: string;
	backgroundColor: Map<string, string>;
	textColor: Map<string, string>;
}

export class DanceDiagram {
	readonly blockName: string;
	readonly backgroundColor: Map<string, string>;
	readonly textColor: Map<string, string>;

	constructor({ blockName, backgroundColor, textColor }: DanceDiagramParams) {
		this.blockName = blockName;
		this.backgroundColor = backgroundColor;
		this.textColor = textColor;
	}
}
