/// <reference types="node" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}