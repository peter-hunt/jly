'use strict'

const LexingError = require('./errors').LexingError
const token = require('./token')
const SourcePosition = token.SourcePosition
const Token = token.Token

class Lexer {
  constructor(rules, ignore_rules) {
    this.rules = rules
    this.ignore_rules = ignore_rules
  }

  lex(s) {
    return new LexerStream(this, s)
  }
}

class LexerStream {
  constructor(lexer, s) {
    this.lexer = lexer
    this.s = s
    this.idx = 0

    this._lineno = 1
    this._colno = 1
  }

  _update_pos(match) {
    this.idx = match.end
    this._lineno += (
      this.s.slice(match.start, match.end).match(/\n/) || []
    ).length
    let last_nl = this.s.slice(0, match.start).lastIndexOf('\n')
    if (last_nl < 0) {
      return match.start + 1
    } else {
      return match.start - last_nl
    }
  }

  next() {
    while (true) {
      if (this.idx >= this.s.length) {
        return
      }

      let ignored = false
      var rule, match
      for (rule of this.lexer.ignore_rules) {
        match = rule.matches(this.s, this.idx)
        if (match) {
          this._update_pos(match)
          ignored = true
          break
        }
      }
      if (!ignored) {
        break
      }
    }

    for (rule of this.lexer.rules) {
      match = rule.matches(this.s, this.idx)
      if (match) {
        var lineno = this._lineno
        this._colno = this._update_pos(match)
        var source_pos = new SourcePosition(match.start, lineno, this._colno)
        return new Token(
          rule.name,
          this.s.slice(match.start, match.end),
          source_pos
        )
      }
    }

    throw new LexingError(
      `Invalid token`,
      new SourcePosition(this.idx, this._lineno, this._colno)
    )
  }
}

LexerStream[Symbol.iterator] = function () {
  return {
    // this is the iterator object, returning a single element (the string "bye")
    next: function () {
      var result = this.next()
      return result === undefined
        ? {
            value: undefined,
            done: true,
          }
        : {
            value: result,
            done: false,
          }
    },
  }
}

module.exports = {
  Lexer,
  LexerStream,
}
