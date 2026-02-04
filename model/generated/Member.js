import { Email } from "./Email.js";
import { MemberName } from "./MemberName.js";
import { MemberType } from "./MemberType.js";
import { Role } from "./Role.js";
export class Member {
    constructor({ id, name, email, type, roles = [], relations = [], active = true, }) {
        this.id = id;
        this.name = new MemberName(name);
        this.email = email ? new Email(email) : undefined;
        this.type = new MemberType(type);
        this.roles = roles.map((r) => new Role(r));
        this.relations = relations;
        this.active = active;
    }
    static fromJson(json) {
        const obj = JSON.parse(json);
        return Member.fromObject(obj);
    }
    static fromObject(obj) {
        var _a;
        return new Member({
            id: obj.id,
            name: obj.name,
            email: obj.email,
            type: obj.type,
            roles: obj.roles || [],
            relations: (obj.relations || []).map((rel) => Member.fromObject(rel)),
            active: (_a = obj.active) !== null && _a !== void 0 ? _a : true,
        });
    }
    toJson() {
        return JSON.stringify(this.toObject());
    }
    toObject() {
        return {
            id: this.id,
            name: this.name.toString(),
            email: this.email ? this.email.toString() : undefined,
            type: this.type.toString(),
            roles: this.roles.map((r) => r.toString()),
            relations: this.relations.map((r) => r.toObject()),
            active: this.active,
        };
    }
}
