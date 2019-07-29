// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';

/**
 * A span representing the character indexes that are contained by a JSONToken.
 */
export class Span {
  constructor(private _startIndex: number, private _length: number) {}

  /**
   * Get the start index of this span.
   */
  get startIndex(): number {
    return this._startIndex;
  }

  /**
   * Get the length of this span.
   */
  get length(): number {
    return this._length;
  }

  /**
   * Get the last index of this span.
   */
  get endIndex(): number {
    return this._startIndex + (this._length > 0 ? this._length - 1 : 0);
  }

  /**
   * Get the index directly after this span.
   *
   * If this span started at 3 and had a length of 4 ([3,7)), then the after
   * end index would be 7.
   */
  get afterEndIndex(): number {
    return this._startIndex + this._length;
  }

  /**
   * Determine if the provided index is contained by this span.
   *
   * If this span started at 3 and had a length of 4 ([3, 7)), then all
   * indexes between 3 and 6 (inclusive) would be contained. 2 and 7 would
   * not be contained.
   */
  contains(index: number, includeAfterEndIndex = false): boolean {
    let result: boolean = this._startIndex <= index;
    if (result) {
      if (includeAfterEndIndex) {
        result = index <= this.afterEndIndex;
      } else {
        result = index <= this.endIndex;
      }
    }
    return result;
  }

  /**
   * Create a new span that is a union of this Span and the provided Span.
   * If the provided Span is null, then this Span will be returned.
   */
  union(rhs: Span): Span {
    let result: Span;
    if (rhs !== null) {
      const minStart = Math.min(this.startIndex, rhs.startIndex);
      const maxAfterEndIndex = Math.max(this.afterEndIndex, rhs.afterEndIndex);
      result = new Span(minStart, maxAfterEndIndex - minStart);
    } else {
      result = this;
    }
    return result;
  }

  translate(movement: number): Span {
    return movement === 0 ? this :
                            new Span(this._startIndex + movement, this._length);
  }

  toString(): string {
    return `[${this.startIndex}, ${this.afterEndIndex})`;
  }
}

export class Position {
  constructor(private _line: number, private _column: number) {
    assert(_line !== null, '_line cannot be null');
    assert(_line !== undefined, '_line cannot be undefined');
    assert(_line >= 0, '_line cannot be less than 0');
    assert(_column !== null, '_column cannot be null');
    assert(_column !== undefined, '_column cannot be undefined');
    assert(_column >= 0, '_column cannot be less than 0');
  }

  get line(): number {
    return this._line;
  }

  get column(): number {
    return this._column;
  }
}

/**
 * An issue that was detected while parsing a deployment template.
 */
export class Issue {
  constructor(private _span: Span, private _message: string) {
    assert(_span !== null, '_span must not be null.');
    assert(_span !== undefined, '_span must not be undefined.');
    assert(
        1 <= _span.length,
        '_span\'s length must be greater than or equal to 1.');
    assert(_message !== null, '_message must not be null.');
    assert(_message !== undefined, '_message must not be undefined');
    assert(_message !== '', '_message must not be empty.');
  }

  get span(): Span {
    return this._span;
  }

  get message(): string {
    return this._message;
  }

  translate(movement: number): Issue {
    return new Issue(this._span.translate(movement), this._message);
  }
}
