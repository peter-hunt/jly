'use strict'

const ParserGeneratorError = require('./errors').ParserGeneratorError

function rightmost_terminal(symbols, terminals) {
  for (let sym of symbols.slice().reverse()) {
    if (sym in terminals) {
      return sym
    }
  }
  return null
}

class Grammar {
  constructor(terminals) {
    // A list of all the productions
    this.productions = [null]
    // A dictionary mapping the names of non-terminals to a list of all
    // productions of that nonterminal
    this.prod_names = {}
    // A dictionary mapping the names of terminals to a list of the rules
    // where they are used
    this.terminals = {}
    for (let t of terminals) {
      this.terminals[t] = []
    }
    this.terminals['error'] = []
    // A dictionary mapping names of nonterminals to a list of rule numbers
    // where they are used
    this.nonterminals = {}
    this.first = {}
    this.follow = {}
    this.precedence = {}
    this.start = null
  }

  add_production(prod_name, syms, func, precedence) {
    if (prod_name in this.terminals) {
      throw new ParserGeneratorError(`Illegal rule name ${prod_name}`)
    }

    var prod_prec
    if (precedence === null) {
      let precname = rightmost_terminal(syms, this.terminals)
      if (precname in this.precedence) {
        prod_prec = this.precedence[precname]
      } else {
        prod_prec = ['right', 0]
      }
    } else {
      if (precedence in this.precedence) {
        prod_prec = this.precedence[precedence]
      } else {
        throw new ParserGeneratorError(`Precedence ${precedence} doesn't exist`)
      }
    }

    let pnumber = this.productions.length
    if (!(prod_name in this.nonterminals)) {
      this.nonterminals[prod_name] = []
    }

    for (let t of syms) {
      if (t in this.terminals) {
        this.terminals[t].push(pnumber)
      } else {
        if (!(t in this.nonterminals)) {
          this.nonterminals[t] = []
        }
        this.nonterminals[t].push(pnumber)
      }
    }

    let p = new Production(pnumber, prod_name, syms, prod_prec, func)
    this.productions.push(p)

    if (!(prod_name in this.prod_names)) {
      this.prod_names[prod_name] = []
    }
    this.prod_names[prod_name].push(p)
  }

  set_precedence(term, assoc, level) {
    if (term in this.precedence) {
      throw new ParserGeneratorError(`Precedence already specified for ${term}`)
    }
    if (!['left', 'right', 'nonassoc'].includes(assoc)) {
      throw new ParserGeneratorError(
        `Precedence must be one of left, right, nonassoc; not ${assoc}`
      )
    }
    this.precedence[term] = [assoc, level]
  }

  set_start() {
    let start = this.productions[1].id
    this.productions[0] = new Production(0, "S'", [start], ['right', 0], null)
    this.nonterminals[start].push(0)
    this.start = start
  }

  unused_terminals() {
    var result = []
    for (let [t, prods] of Object.entries(this.terminals)) {
      if (!prods && t !== 'error') {
        result.push(t)
      }
    }
    return result
  }

  unused_productions() {
    var result = []
    for (let item of Object.entries(this.nonterminals)) {
      let p = item[0],
        prods = item[1]
      if (!prods) {
        result.push(p)
      }
    }
    return result
  }

  build_lritems() {
    // Walks the list of productions and builds a complete set of the LR items.
    for (var p of this.productions) {
      var lastlri = p,
        i = 0,
        lr_items = []
      while (true) {
        var lri
        if (i > p.getlength()) {
          lri = null
        } else {
          var before, after
          if (i - 1 < p.prod.length) {
            before = p.prod[i - 1]
          } else {
            before = null
          }
          if (i < p.prod.length && p.prod[i] in this.prod_names) {
            after = this.prod_names[p.prod[i]]
          } else {
            after = []
          }
          lri = new LRItem(p, i, before, after)
        }
        lastlri.lr_next = lri
        if (lri === null) {
          break
        }
        lr_items.push(lri)
        lastlri = lri
        i++
      }
      p.lr_items = lr_items
    }
  }

  _first(beta) {
    var result = [],
      broken = false
    for (let x of beta) {
      var x_produces_empty = false
      for (let f of this.first[x]) {
        if (f == '<empty>') {
          x_produces_empty = True
        } else {
          if (!(f in result)) {
            result.push(f)
          }
        }
      }
      if (!x_produces_empty) {
        broken = true
        break
      }
    }
    if (!broken) {
      result.push('<empty>')
    }
    return result
  }

  compute_first() {
    for (let t of Object.keys(this.terminals)) {
      this.first[t] = [t]
    }

    this.first['$end'] = ['$end']

    for (let n of Object.keys(this.nonterminals)) {
      this.first[n] = []
    }

    var changed = true
    while (changed) {
      changed = false
      for (let n of Object.keys(this.nonterminals)) {
        for (let p of this.prod_names[n]) {
          for (let f of this._first(p.prod)) {
            if (!(f in this.first[n])) {
              this.first[n].push(f)
              changed = true
            }
          }
        }
      }
    }
    console.log('ha')
  }

  compute_follow() {
    for (let k of Object.keys(this.nonterminals)) {
      this.follow[k] = []
    }

    let start = this.start
    this.follow[start] = ['$end']

    var added = true
    while (added) {
      added = true
      for (let p of this.productions[1]) {
        var i = 0
        for (let B of p.prod) {
          if (B in this.nonterminals) {
            let fst = this._first(p.prod[i + 1])
            var has_empty = false
            for (f of fst) {
              if (f !== '<empty>' && !(f in this.follow[B])) {
                this.follow[B].push(f)
                added = true
              }
              if (f === '<empty>') {
                has_empty = true
              }
            }
            if (has_empty || i == p.prod.length - 1) {
              for (f of this.follow[p.name]) {
                if (!(f in this.follow[B])) {
                  this.follow[B].push(f)
                  added = true
                }
              }
            }
          }
          i++
        }
      }
    }
  }
}

class Production {
  constructor(num, id, prod, precedence, func) {
    this.id = id
    this.prod = prod
    this.number = num
    this.func = func
    this.prec = precedence

    this.unique_syms = []
    for (let s of this.prod) {
      if (!(s in this.unique_syms)) {
        this.unique_syms.push(s)
      }
    }

    this.lr_items = []
    this.lr_next = null
    this.lr0_added = 0
    this.reduced = 0
  }

  getlength() {
    return this.prod.length
  }
}

class LRItem {
  constructor(p, n, before, after) {
    this.name = p.name
    this.prod = p.prod.slice()
    this.prod.splice(n, 0, '.')
    this.number = p.number
    this.lr_index = n
    this.lookaheads = {}
    this.unique_syms = p.unique_syms
    this.lr_before = before
    this.lr_after = after
  }

  getlength() {
    return this.prod.length
  }
}

module.exports = {
  Grammar,
  Production,
}
