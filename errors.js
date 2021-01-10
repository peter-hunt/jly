'use strict'

class ParserGeneratorError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

class LexingError extends Error {
  // Raised by a Lexer, if no rule matches.
  constructor(message, source_pos) {
    super(message)
    this.name = this.constructor.name
    this.source_pos = source_pos
    Error.captureStackTrace(this, this.constructor)
  }

  getsourcepos() {
    // Returns the position in the source, at which this error occurred.
    return this.source_pos
  }
}

class ParsingError extends Error {
  // Raised by a Parser, if no production rule can be applied.
  constructor(message, source_pos) {
    super(message)
    this.name = this.constructor.name
    this.source_pos = source_pos
    Error.captureStackTrace(this, this.constructor)
  }

  getsourcepos() {
    // Returns the position in the source, at which this error occurred.
    return this.source_pos
  }
}

module.exports = {
  ParserGeneratorError,
  LexingError,
  ParsingError,
}
