'use strict';

import { Coder, Reader, Writer } from './abstract-coder';

// Clones the functionality of an existing Coder, but without a localName
export class AnonymousCoder extends Coder {
  private coder: Coder;

  constructor(coder: Coder) {
    super(coder.name, coder.type, undefined, coder.dynamic);
    this.coder = coder;
  }

  defaultValue(): any {
    return this.coder.defaultValue();
  }

  encode(writer: Writer, value: any): number {
    let tmpSize = writer.wordSize;

    writer.resetWriteSize(this.coder.size);
    let ret = this.coder.encode(writer, value);
    writer.resetWriteSize(tmpSize);
    return ret;
  }

  decode(reader: Reader): any {
    return this.coder.decode(reader);
  }
}
