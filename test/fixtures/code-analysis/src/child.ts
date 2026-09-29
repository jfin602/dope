import { Base, greet, type Named } from '@lib/base';
export class Child extends Base implements Named {
  name = 'Ada';
  speak(): string { return greet(this); }
}
export { greet } from '@lib/base';
