'use strict'

const jly = require('jly')


const TOKEN_PATTERNS = [
  ('NUMBER', /\d+/),
  ('word', /[A-Za-z_]+/),
]

const IGNORED_PATTERNS = [
  /\s+/,
]


class LexerGenerator extends jly.LexerGenerator {
  constructor () {
    this.lexer =  jly.LexerGenerator
  }

  add_tokens() {
    for (name, pattern of TOKEN_PATTERNS) {
      if pattern.match(/^[a-z]+$/) {
        this.lexer.add(name, `\\b${pattern}\\b`)
      } else {
        this.lexer.add(name, `\\b${pattern}\\b`)
      }
    }

    for (pattern of IGNORED_PATTERNS) {
      this.lexer.ignore(pattern)
    }
  }

  get_lexer() {
    this.add_tokens()
    return this.lexer.build()
  }
}



lexer_generator = new LexerGenerator()
lexer = lexer_generator.get_lexer()


function lex(source: string) {
  return lexer.lex(source)
}


const source = '1 2 3'
