/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare module '*.css';

declare module '*.wav?url' {
  const url: string;
  export default url;
}
