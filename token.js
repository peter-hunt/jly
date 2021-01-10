'use strict'

class Token {
  /* Represents a syntactically relevant piece of text.
     :param name: A string describing the kind of text represented.
     :param value: The actual text represented.
     :param source_pos: A :class:`SourcePosition` object representing the
                        position of the first character in the source from which
                        this token was generated. */

  constructor(name, value, source_pos = null) {
    this.name = name
    this.value = value
    this.source_pos = source_pos
  }

  equalsTo(other) {
    if (other instanceof Token) {
      return this.name == other.name && this.value == other.value
    }
  }

  gettokentype() {
    // Returns the type or name of the token.
    return this.name
  }

  getsourcepos() {
    /* Returns a: class: `SourcePosition` instance,
       describing the position of this token's first character
       in the source. */
    return this.source_pos
  }

  getstr() {
    // Returns the string represented by this token.
    return self.value
  }
}

class SourcePosition {
  /* Represents the position of a character in some source string.
     : param idx: The index of the character in the source.
     : param lineno: The number of the line in which the character occurs.
     : param colno: The number of the column in which the character occurs.
                    The values passed to this object can be retrieved using
                    the identically named attributes. */

  constructor(idx, lineno, colno) {
    this.idx = idx
    this.lineno = lineno
    this.colno = colno
  }
}

module.exports = {
  Token,
  SourcePosition,
}
