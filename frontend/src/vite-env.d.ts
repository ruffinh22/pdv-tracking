/// <reference types="vite/client" />

declare module "*.css" {
  const styles: { [className: string]: string }
  export default styles
}
