"use strict";

const LexerGenerator = require("./lexergenerator").LexerGenerator;

const TOKEN_PATTERNS = [
  ["NUMBER", /\d+/],
  ["word", /[A-Za-z_]+/],
];

const IGNORED_PATTERNS = [/\s+/];

class Generator {
  constructor() {
    this.lexer = new LexerGenerator();
  }

  add_tokens() {
    var pair, pattern;
    for (pair of TOKEN_PATTERNS) {
      this.lexer.add(...pair);
    }
    for (pattern of IGNORED_PATTERNS) {
      this.lexer.ignore("", pattern);
    }
  }

  get_lexer() {
    this.add_tokens();
    return this.lexer.build();
  }
}

var generator = new Generator();
var lexer = generator.get_lexer();

const source = "";

const result = lexer.lex(source);

var item;

while (true) {
  item = result.next();
  if (item === undefined) {
    break;
  }
  console.log(item);
}
