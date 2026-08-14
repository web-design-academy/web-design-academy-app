declare module "css-tree" {
  export function parse(source: string, options?: unknown): any;
  export function generate(node: any): string;
  export function walk(ast: any, options: any): void;
}
