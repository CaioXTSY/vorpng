import { Blob } from 'buffer';

if (typeof globalThis.File === 'undefined') {
  class File extends Blob {
    name: string;
    lastModified: number;

    constructor(bits: any[], name: string, options?: any) {
      super(bits, options);
      this.name = name;
      this.lastModified = options?.lastModified ?? Date.now();
    }

    get [Symbol.toStringTag]() {
      return 'File';
    }
  }

  (globalThis as any).File = File;
}
