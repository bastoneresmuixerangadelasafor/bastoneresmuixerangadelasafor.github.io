interface TrainingSessionParams {
  name: string;
  datetime: Date;
  description: string;
}

export class TrainingSession {
  readonly name: string;
  readonly datetime: Date;
  readonly description: string;

  constructor({ name, datetime, description }: TrainingSessionParams) {
    this.name = name;
    this.datetime = datetime;
    this.description = description;
  }
}
