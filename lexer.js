'use strict'

import { LexingError } from "errors"
import { SourcePosition, Token } from "token"


class Lexer {
  constructor(rules, ignore_rules) {
    this.rules = rules
    this.ignore_rules = ignore_rules
  }

  lex(s) {
    return LexerStream(this, s)
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
    this.lineno += this.s.slice(match.start, match.end).count('\n')
    last_nl = this.s.slice(0, match.start).lastIndexOf('\n')
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
      for (rule of this.lexer.ignore_rules) {
        match = this.s.slice(this.idx).match(rule)
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
        lineno = this._lineno
        this._colno = this._update_pos(match)
        source_pos = SourcePosition(match.start, lineno, this._colno)
        token = Token(
          rule.name, this.s.slice(match.start, match.end), source_pos
        )
        return token
      }
    }

    throw LexingError(null, SourcePosition(this.idx, this._lineno, this._colno))
  }
}
