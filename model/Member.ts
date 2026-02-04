import { Email } from "./Email.js";
import { MemberName } from "./MemberName.js";
import { MemberType } from "./MemberType.js";
import { Role } from "./Role.js";

interface MemberParams {
  id: string;
  name: string;
  email?: string;
  type: string;
  roles?: string[];
  relations?: Member[];
  active?: boolean;
}

export class Member {
  readonly id: string;
  readonly name: MemberName;
  readonly email?: Email;
  readonly type: MemberType;
  readonly roles: Role[];
  readonly relations: Member[];
  readonly active: boolean;

  constructor({
    id,
    name,
    email,
    type,
    roles = [],
    relations = [],
    active = true,
  }: MemberParams) {
    this.id = id;
    this.name = new MemberName(name);
    this.email = email ? new Email(email) : undefined;
    this.type = new MemberType(type);
    this.roles = roles.map((r) => new Role(r));
    this.relations = relations;
    this.active = active;
  }

  static fromJson(json: string): Member {
    const obj = JSON.parse(json);
    return Member.fromObject(obj);
  }

  static fromObject(obj: any): Member {
    return new Member({
      id: obj.id,
      name: obj.name,
      email: obj.email,
      type: obj.type,
      roles: obj.roles || [],
      relations: (obj.relations || []).map((rel: any) =>
        Member.fromObject(rel),
      ),
      active: obj.active ?? true,
    });
  }

  toJson(): string {
    return JSON.stringify(this.toObject());
  }

  toObject(): any {
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
