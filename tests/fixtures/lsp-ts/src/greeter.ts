export class Greeter {
  constructor(private readonly greeting: string) {}

  greet(name: string): string {
    return `${this.greeting}, ${name}`;
  }

  shout(name: string): string {
    return this.greet(name).toUpperCase();
  }
}
