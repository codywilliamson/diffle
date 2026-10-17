import { Greeter } from "./greeter";
import { echoed, label } from "./text";
import { double } from "tiny-dep";

const greeter = new Greeter("hello");
console.log(greeter.greet("world"), greeter.shout(label), double(21), echoed);
