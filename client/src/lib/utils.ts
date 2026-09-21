import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn-svelte's class combiner: clsx for conditionals, tailwind-merge to dedupe utilities.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
