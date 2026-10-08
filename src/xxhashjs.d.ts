declare module "xxhashjs" {
  interface Hash64 {
    update(data: ArrayBuffer | string): Hash64;
    digest(): { toString(radix?: number): string };
  }
  const xxhash: { h64(seed?: number): Hash64 };
  export default xxhash;
}
