import { ping, Worker } from './invoked';
export const onlyReference = ping;
export const onlyProperty = Worker.prototype.run;
