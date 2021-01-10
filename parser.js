'use strict'

const ParsingError = require('./errors').ParsingError

class LRParser {
  constructor(lr_table, error_handler) {
    this.lr_table = lr_table
    this.error_handler = error_handler
  }

  parse(tokenizer, state = null) {
    const Token = require('./token').Token

    var lookahead = null
    var lookaheadstack = []

    var statestack = [0]
    var symstack = [new Token('$end', '$end')]

    var current_state = 0
    while (true) {
      if (this.lr_table.default_reductions[current_state]) {
        let t = this.lr_table.default_reductions[current_state]
        current_state = this._reduce_production(t, symstack, statestack, state)
        continue
      }
      if (lookahead === null) {
        if (lookaheadstack) {
          lookahead = lookaheadstack.pop()
        } else {
          lookahead = tokenizer.next()
          if (lookahead === undefined) {
            lookahead = null
          }
        }

        if (lookahead === null) {
          lookahead = new Token('$end', '$end')
        }
      }

      var ltype = lookahead.gettokentype()
      if (ltype in this.lr_table.lr_action[current_state]) {
        var t = this.lr_table.lr_action[current_state][ltype]
        if (t > 0) {
          statestack.push(t)
          current_state = t
          symstack.push(lookahead)
          lookahead = null
          continue
        } else if (t < 0) {
          current_state = this._reduce_production(
            t,
            symstack,
            statestack,
            state
          )
          continue
        } else {
          return symstack[-1]
        }
      } else {
        if (this.error_handler !== null) {
          if (state === null) {
            this.error_handler(lookahead)
          } else {
            this.error_handler(state, lookahead)
          }
          throw Error('For now, error_handler must raise.')
        } else {
          throw ParsingError(null, lookahead.getsourcepos)
        }
      }
    }
  }

  _reduce_production(t, symstack, statestack, state) {
    // reduce a symbol on the stack and emit a production
    var p = this.lr_table.grammar.productions[-t]
    let pname = p.name
    let plen = p.getlength()
    let start = symstack.length + (-plen - 1)
    if (start < 0) {
      throw Error('Assertion triggered')
    }
    let targ = symstack.slice(start + 1)
    start = symstack.length + -plen
    if (start < 0) {
      throw Error('Assertion triggered')
    }
    symstack = symstack.slice(0, start)
    statestack = statestack.slice(0, start)
    if (state === null) {
      value = p.func(targ)
    } else {
      value = p.func(state, targ)
    }
    symstack.push(value)
    let current_state = this.lr_table.lr_goto[statestack[-1]][pname]
    statestack.push(current_state)
    return current_state
  }
}

module.exports = {
  LRParser,
}
