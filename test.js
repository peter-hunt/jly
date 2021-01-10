'use strict'

const JlyLexerGenerator = require('./lexergenerator').LexerGenerator
const JlyParserGenerator = require('./parsergenerator').ParserGenerator

const TOKEN_PATTERNS = [
  ['NUMBER', /\d+/],
  ['PLUS', /\+/],
  ['MINUS', /-/],
]

var tokens = []
for (var [id, pattern] of TOKEN_PATTERNS) {
  tokens.push(id)
}
const TOKENS = tokens.slice()

const IGNORED_PATTERNS = [/\s+/]

class LexerGenerator {
  constructor() {
    this.lexer = new JlyLexerGenerator()
  }

  add_tokens() {
    var pair, pattern
    for (pair of TOKEN_PATTERNS) {
      this.lexer.add(...pair)
    }
    for (pattern of IGNORED_PATTERNS) {
      this.lexer.ignore('', pattern)
    }
  }

  get_lexer() {
    this.add_tokens()
    return this.lexer.build()
  }
}

class Parser {
  constructor() {
    this.pg = new JlyParserGenerator(TOKENS, [['left', ['PLUS', 'MINUS']]])
  }

  add_syntaxes() {
    this.pg.production('expr : NUMBER')((p) => {
      console.log(p[1])
      return p[1]
    })
    this.pg.production('expr : expr PLUS expr')((p) => {
      console.log(`${p[1]} + ${p[3]} => ${p[1] + p[3]}`)
      return p[1] + p[3]
    })
    this.pg.production('expr : expr MINUS expr')((p) => {
      console.log(`${p[1]} - ${p[3]} => ${p[1] - p[3]}`)
      return p[1] + p[3]
    })

    this.pg.error((token) => {
      throw new SyntaxError('invalid syntax')
    })
  }

  get_parser() {
    this.add_syntaxes()
    return this.pg.build()
  }
}

const generator = new LexerGenerator()
const lexer = generator.get_lexer()

const parser = new Parser().get_parser()

const source = '1 + 2'

function parse(source) {
  const tokens = lexer.lex(source)

  try {
    parser.parse(tokens)
  } catch (err) {
    if (err instanceof LexingError) {
      var index = err.source_pos.idx
      let lineno = source.slice(0, index).count('\n')
      let line = source.split('\n')[lineno]
      var padding
      if ('\n' in source.slice(0, index)) {
        padding = (index - source.slice(0, index).lastIndexOf('\n')) * ' '
      } else {
        padding = index * ' '
      }
      throw `  File "${path}", line ${
        lineno + 1
      }\n    ${line}\n   ${padding}^\nSyntaxError: invalid syntax`
    } else {
      throw err
    }
  }
}

parse(source)
