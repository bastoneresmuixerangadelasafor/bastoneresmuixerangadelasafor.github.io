export class DancePosition {
    constructor({ order, tag, positionType, specifications }) {
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
    getSpecifications() {
        return this.specifications;
    }
    toString() {
        return this.order.toString();
    }
}
