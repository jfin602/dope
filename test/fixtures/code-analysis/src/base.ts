export interface Named { name: string }
export class Base { speak(): string { return 'hi'; } }
export function greet(person: Named): string { return person.name; }
