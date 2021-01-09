'use strict'

import { Lexer } from "lexer";

class Rule {
  constructor(name, regex, flags = 0) {
    this.name = name
    this.regex = regex
  }

  matches(s, pos) {
    m = s.slice(pos).match(this.regex)
    if (m !== null && m.index === 0) {
      return Match(pos, pos + m[0].length)
    }
  }
}

class Match {
  constructor(start, end) {
    this.start = start
    this.end = end
  }
}

class LexerGenerator {
  /* A LexerGenerator represents a set of rules that match pieces of text that
     should either be turned into tokens or ignored by the lexer.
     Rules are added using the :meth:`add` and :meth:`ignore` methods:
     > const jly = require('jly')
     > const LexerGenerator = jly.LexerGenerator
     > var lg = LexerGenerator()
     > lg.add('NUMBER', /\d+/)
     > lg.add('ADD', /\+/)
     > lg.ignore(/\s+/)
     The rules are passed to :func:`re.compile`. If you need additional flags,
     e.g. :const:`re.DOTALL`, you can pass them to :meth:`add` and
     :meth:`ignore` as an additional optional parameter:
     > import re
     > lg.add('ALL', /.*\/s)
     You can then build a lexer with which you can lex a string to produce an
     iterator yielding tokens:
     > lexer = lg.build()
     > iterator = lexer.lex('1 + 1')
     > iterator.next()
     Token('NUMBER', '1')
     > iterator.next()
     Token('ADD', '+')
     > iterator.next()
     Token('NUMBER', '1')
     > iterator.next()
     null */

  constructor() {
    this.rules = []
    this.ignore_rules = []
  }

  add (name, pattern) {
    /* Adds a rule with the given `name` and `pattern`. In case of ambiguity,
       the first rule added wins. */
    this.rules.push(Rule(name, pattern))
  }

  ignore (name, pattern) {
    /* Adds a rule whose matched value will be ignored. Ignored rules will be
        matched before regular ones. */
    this.ignore_rules.push(Rule('', pattern))
  }

  build () {
    /* Returns a lexer instance, which provides a `lex` method that must be
       called with a string and returns an iterator yielding
       :class:`~jly.Token` instances. */
    return Lexer(this.rules, this.ignore_rules)
  }
}

module.exports = {
  Rule,
  Match,
  LexerGenerator,
}
