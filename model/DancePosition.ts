import { PositionType } from './PositionType.js';

interface DancePositionParams {
  order: number;
  tag: string;
  positionType: PositionType;
  specifications: string;
}

export class DancePosition {
  readonly order: number;
  readonly positionType: PositionType;
  readonly specifications: string;
  readonly tag: string;

  constructor({ order, tag, positionType, specifications }: DancePositionParams) {
    if (order <= 0) {
      throw new Error('DancePosition order must be a positive number');
    }
    if (!tag || tag.trim() === '') {
      throw new Error('Tag cannot be empty');
    }
    if (!specifications || specifications.trim() === '') {
      throw new Error('Specifications cannot be empty');
    }
    this.order = order;
    this.positionType = positionType;
    this.specifications = specifications;
    this.tag = tag;
  }

  getSpecifications(): string {
    return this.specifications;
  }

  toString(): string {
    return this.order.toString();
  }
}
