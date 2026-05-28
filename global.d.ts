// Global type declarations

// Allow importing CSS files
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Allow side-effect imports of CSS files
declare module '*.css' {
  const content: any;
  export = content;
}
