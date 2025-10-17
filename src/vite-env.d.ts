/// <reference types="vite/client" />

// Type definitions for CSS imports
declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.css?inline" {
  const content: string;
  export default content;
}
