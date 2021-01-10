'use strict'

const fs = require('fs')
const sha1 = require('js-sha1')
const AppDirs = require('appdirs').AppDirs
const inspect = require('util').inspect

const errors = require('./errors')
const ParserGeneratorError = errors.ParserGeneratorError
// const ParserGeneratorWarning = errors.ParserGeneratorWarning
const Grammar = require('./grammar').Grammar
const LRParser = require('./parser').LRParser
const utils = require('./utils')
const Counter = utils.Counter
const IdentityDict = utils.IdentityDict

const LARGE_VALUE = Number.MAX_SAFE_INTEGER

class ParserGenerator {
  /* A ParserGenerator represents a set of production rules, that define a
     sequence of terminals and non-terminals to be replaced with a non-terminal,
     which can be turned into a parser.
     :param tokens: A list of token (non-terminal) names.
     :param precedence: A list of tuples defining the order of operation for
                        avoiding ambiguity, consisting of a string defining
                        associativity (left, right or nonassoc) and a list of
                        token names with the same associativity and level of
                        precedence.
     :param cache_id: A string specifying an ID for caching. */
  VERSION = 1

  constructor(tokens, precedence = [], cache_id = null) {
    this.tokens = tokens
    this.productions = []
    this.precedence = precedence
    this.cache_id = cache_id
    this.error_handler = null
  }

  production(rule, precedence = null) {
    /* A decorator that defines one or many production rules and registers
       the decorated function to be called with the terminals and
       non-terminals matched by those rules.
       A `rule` should consist of a name defining the non-terminal returned
       by the decorated function and one or more sequences of pipe-separated
       non-terminals and terminals that are supposed to be replaced::
           replacing_non_terminal : TERMINAL1 non_term1 | TERMINAL2 non_term2
       The name of the non-terminal replacing the sequence is on the left,
       separated from the sequence by a colon. The whitespace around the colon
       is required.
       Knowing this we can define productions::
           pg = ParserGenerator(['NUMBER', 'ADD'])
           @pg.production('number : NUMBER')
           def expr_number(p):
               return BoxInt(int(p[0].getstr()))
           @pg.production('expr : number ADD number')
           def expr_add(p):
               return BoxInt(p[0].getint() + p[2].getint())
       If a state was passed to the parser, the decorated function is
       additionally called with that state as first argument. */
    let parts = rule.split(/\s+/)
    var production_name = parts[0]
    if (parts[1] != ':') {
      throw new ParserGeneratorError(
        'Expecting : with spaces around after rule name'
      )
    }

    let body = parts.slice(2).join(' ')
    var prods = body.split('|')

    return (func) => {
      for (let production of prods) {
        let syms = production.split(/\s+/)
        this.productions.push([production_name, syms, func, precedence])
      }
      return func
    }
  }

  error(func) {
    /* Sets the error handler that is called with the state (if passed to the
       parser) and the token the parser errored on.
       Currently error handlers must raise an exception. If an error handler
       is not defined, a :exc:`rply.ParsingError` will be raised. */
    this.error_handler = func
    return func
  }

  compute_grammar_hash(g) {
    var hasher = sha1.create()
    hasher.update(g.start)
    hasher.update(JSON.stringify(g.terminals.slice.sort()))
    for (let [term, [assoc, level]] of Object.entries(g.precedence)
      .slice()
      .sort()) {
      hasher.update(term)
      hasher.update(assoc)
      hasher.update(ArrayBuffer(level))
    }
    for (let p of g.productions) {
      hasher.update(p.name)
      hasher.update(JSON.stringify(p.prec))
      hasher.update(JSON.stringify(p.prod))
    }
    return hasher.hex()
  }

  serialize_table(table) {
    var productions = []
    for (let p of table.grammar.productions) {
      productions.push((p.name, p.prod, p.prec))
    }
    return {
      lr_action: table.lr_action,
      lr_goto: table.lr_goto,
      sr_conflicts: table.sr_conflicts,
      rr_conflicts: table.rr_conflicts,
      default_reductions: table.default_reductions,
      start: table.grammar.start,
      terminals: table.grammar.terminals.slice().sort(),
      precedence: table.grammar.precedence,
      productions: productions,
    }
  }

  data_is_valid(g, data) {
    if (g.start != data['start']) {
      return false
    }
    if (g.terminals.slice().sort() != data['terminals']) {
      return false
    }
    if (g.precedence.slice().sort() != data['precedence'].slice().sort()) {
      return false
    }
    for (var [key, [assoc, level]] of Object.entries(g.precedence)) {
      if (data['precedence'][key] != [assoc, level]) {
        return false
      }
    }
    if (g.productions.length != data['productions'].length) {
      return false
    }
    var p, id, prod, assoc, level
    for (var i = 0; i < g.productions.length; i++) {
      p = g.productions[i]
      ;[id, prod, [assoc, level]] = data['productions']
      if (p.name != id || p.prod != prod || p.prec != (assoc, level)) {
        return false
      }
    }
    return true
  }

  build() {
    var g = new Grammar(this.tokens)

    var level = 1
    for (let [assoc, terms] of this.precedence) {
      for (let term of terms) {
        g.set_precedence(term, assoc, level)
      }
    }

    for (let [prod_name, syms, func, precedence] of this.productions) {
      g.add_production(prod_name, syms, func, precedence)
    }

    g.set_start()

    for (let unused_term of g.unused_terminals()) {
      console.warn(`Token ${unused_term} is unused`)
    }
    for (let unused_prod of g.unused_productions()) {
      console.warn(`Production ${unused_prod} is not reachable`)
    }

    g.build_lritems()
    g.compute_first()
    g.compute_follow()

    var table = null
    if (this.cache_id !== null) {
      cache_dir = AppDirs('jly').user_cache_dir
      cache_file = path.join(
        cache_dir,
        `${this.cache_id}-${this.VERSION}-${his.compute_grammar_hash(g)}.json`
      )

      if (fs.existsSync(cache_file)) {
        let data = require(cache_file)
        if (this.data_is_valid(g, data)) {
          table = LRTable.from_cache(g, data)
        }
      }
    }
    if (table === null) {
      table = LRTable.from_grammar(g)

      if (this.cache_id !== null) {
        this._write_cache(cache_dir, cache_file, table)
      }
    }

    if (table.sr_conflicts) {
      let s = table.sr_conflicts.length > 1 ? 's' : ''
      console.warn(`${table.sr_conflicts.length} shift/reduce conflict${s}`)
    }
    if (table.rr_conflicts) {
      let s = table.sr_conflicts.length > 1 ? 's' : ''
      console.warn(`${table.rr_conflicts.length} reduce/reduce conflict${s}`)
    }
    return new LRParser(table, this.error_handler)
  }

  _write_cache(cache_dir, cache_file, table) {
    if (fs.existsSync(cache_dir)) {
      fs.mkdir(cache_dir)
    }

    fs.writeSync(cache_file, JSON.stringify(this.serialize_table(table)))
  }
}

function digraph(X, R, FP) {
  var N = {},
    stack = [],
    F = {}

  for (let x of X) {
    N[x] == 0
  }
  for (let x of X) {
    traverse(x, N, stack, F, X, R, FP)
  }
  return F
}

function traverse(x, N, stack, F, X, R, FP) {
  stack.push(x)
  let d = stack.length
  N[x] = d
  F[x] = FP(x)

  let rel = R(x)
  for (let y of rel) {
    if (N[y] == 0) {
      traverse(y, N, stack, F, X, R, FP)
    }
    N[x] = min(N[x], N[y])
    for (let a of F.get(y, [])) {
      if (!a in F[x]) {
        F[x].push(a)
      }
    }
  }
  if (N[x] == d) {
    N[stack[-1]] = LARGE_VALUE
    F[stack[-1]] = F[x]
    var element = stack.pop()
    while (element != x) {
      N[stack[-1]] = LARGE_VALUE
      F[stack[-1]] = F[x]
      element = stack.pop()
    }
  }
}

class LRTable {
  constructor(
    grammar,
    lr_action,
    lr_goto,
    default_reductions,
    sr_conflicts,
    rr_conflicts
  ) {
    this.grammar = grammar
    this.lr_action = lr_action
    this.lr_goto = lr_goto
    this.default_reductions = default_reductions
    this.sr_conflicts = sr_conflicts
    this.rr_conflicts = rr_conflicts
  }
}

LRTable.from_cache = (grammar, data) => {
  let lr_action = []
  for (let action of data['lr_action']) {
    let item = {}
    for (let [k, v] of Object.entries(action)) {
      item[`${k}`] = v
    }
    lr_action.push(item)
  }
  let lr_goto = []
  for (let goto of data['lr_goto']) {
    let item = {}
    for (let [k, v] of Object.entries(goto)) {
      item[`${k}`] = v
    }
    lr_goto.push(item)
  }
  return new LRTable(
    grammar,
    lr_action,
    lr_goto,
    data['default_reductions'],
    data['sr_conflicts'],
    data['rr_conflicts']
  )
}

LRTable.from_grammar = (grammar) => {
  var cidhash = new IdentityDict()
  var goto_cache = {}
  var add_count = new Counter()
  let C = LRTable.lr0_items(grammar, add_count, cidhash, goto_cache)
  LRTable.add_lalr_lookaheads(grammar, C, add_count, cidhash, goto_cache)
  var lr_action = [null] * C.length
  var lr_goto = [null] * C.length
  var sr_conflicts = []
  var rr_conflicts = []
  var st = 0
  for (let I of C) {
    var st_action = {}
    var st_actionp = {}
    var st_goto = {}
    for (let p of I) {
      if (p.getlength() == p.lr_index + 1) {
        if (p.name == "S'") {
          // Start symbol. Accept!
          st_action['$end'] = 0
          st_actionp['$end'] = p
        } else {
          let laheads = p.lookaheads[st]
          for (let a of laheads) {
            if (a in st_action) {
              r = st_action[a]
              if (r > 0) {
                var [sprec, slevel] = grammar.productions[
                  st_actionp[a].number
                ].prec
                var [rprec, rlevel] = grammar.precedence.get(a, ('right', 0))
                if (slevel < rlevel || (slevel == rlevel && rprec == 'left')) {
                  st_action[a] = -p.number
                  st_actionp[a] = p
                  if (!slevel && !rlevel) {
                    sr_conflicts.push((st, inspect(a), 'reduce'))
                  }
                  grammar.productions[p.number].reduced++
                } else if (!(slevel == rlevel && rprec == 'nonassoc')) {
                  if (!rlevel) {
                    sr_conflicts.push((st, inspect(a), 'shift'))
                  }
                }
              } else if (r < 0) {
                var oldp = grammar.productions[-r]
                var pp = grammar.productions[p.number]
                var chosenp, rejectp
                if (oldp.number > pp.number) {
                  st_action[a] = -p.number
                  st_actionp[a] = p
                  ;[chosenp, rejectp] = [pp, oldp]
                  grammar.productions[p.number].reduced++
                  grammar.productions[oldp.number].reduced--
                } else {
                  ;[chosenp, rejectp] = [oldp, pp]
                }
                rr_conflicts.push((st, inspect(chosenp), inspect(rejectp)))
              } else {
                throw new ParserGeneratorError(
                  `Unknown conflict in state ${st}`
                )
              }
            } else {
              st_action[a] = -p.number
              st_actionp[a] = p
              grammar.productions[p.number].reduced++
            }
          }
        }
      } else {
        let i = p.lr_index
        var a = p.prod[i + 1]
        if (a in grammar.terminals) {
          g = LRTable.lr0_goto(I, a, add_count, goto_cache)
          j = cidhash.get(g, -1)
          if (j >= 0) {
            if (a in st_action) {
              r = st_action[a]
              if (r > 0 && r != j) {
                throw new ParserGeneratorError(
                  `Shift/shift conflict in state ${st}`
                )
              } else if (r < 0) {
                var rprec,
                  rlevel = grammar.productions[st_actionp[a].number].prec
                var sprec,
                  slevel = grammar.precedence.get(a, ('right', 0))
                if (slevel > rlevel || (slevel == rlevel && rprec == 'right')) {
                  grammar.productions[st_actionp[a].number].reduced--
                  st_action[a] = j
                  st_actionp[a] = p
                  if (!rlevel) {
                    sr_conflicts.push((st, inspect(a), 'shift'))
                  }
                } else if (!(slevel == rlevel && rprec == 'nonassoc')) {
                  if (!slevel && !rlevel) {
                    sr_conflicts.push((st, inspect(a), 'reduce'))
                  }
                }
              } else {
                throw new ParserGeneratorError(
                  `Unknown conflict in state ${st}`
                )
              }
            } else {
              st_action[a] = j
              st_actionp[a] = p
            }
          }
        }
      }
    }
    var nkeys = Set()
    for (let ii of I) {
      for (let s of ii.unique_syms) {
        if (s in grammar.nonterminals) {
          nkeys.add(s)
        }
      }
    }
    for (let n of nkeys) {
      let g = LRTable.lr0_goto(I, n, add_count, goto_cache)
      let j = cidhash.get(g, -1)
      if (j >= 0) {
        st_goto[n] = j
      }
    }
    lr_action[st] = st_action
    lr_goto[st] = st_goto
    st++
  }
  var default_reductions = [0] * lr_action.length
  var state = 0
  for (var actions of lr_action) {
    actions = Set(Object.values(actions))
    if (actions.length == 1 && [...actions][0] < 0) {
      default_reductions[state] = [...actions][0]
      state++
    }
  }
  return LRTable(
    grammar,
    lr_action,
    lr_goto,
    default_reductions,
    sr_conflicts,
    rr_conflicts
  )
}

LRTable.lr0_items = (grammar, add_count, cidhash, goto_cache) => {
  var C = [LRTable.lr0_closure([grammar.productions[0].lr_next], add_count)]
  var i = 0
  for (var I of C) {
    cidhash.setItem(I, i)
  }

  i = 0
  while (i < C.length) {
    I = C[i]
    i++

    var asyms = Set()
    for (let ii of I) {
      asyms.update(ii.unique_syms)
    }
    for (let x in asyms) {
      g = LRTable.lr0_goto(I, x, add_count, goto_cache)
      if (!g) {
        continue
      }
      if (cidhash.contains(g)) {
        continue
      }
      cidhash.setItem(g, C.length)
      C.push(g)
    }
  }
  return C
}

LRTable.lr0_closure = (I, add_count) => {
  add_count.incr()

  var J = I.slice(),
    added = true
  while (added) {
    added = false
    for (let j of J) {
      for (let x of j.lr_after) {
        if (x.lr0_added == add_count.value) {
          continue
        }
        J.push(x.lr_next)
        x.lr0_added = add_count.value
        added = true
      }
    }
  }
  return J
}

LRTable.lr0_goto = (I, x, add_count, goto_cache) => {
  var s = goto_cache.setdefault(x, new IdentityDict())

  var gs = []
  for (let p of I) {
    let n = p.lr_next
    if (n && n.lr_before == x) {
      let s1 = s.get(n)
      if (!s1) {
        s1 = {}
        s[n] = s1
      }
      gs.push(n)
      s = s1
    }
  }
  let g = s.get('$end')
  if (!g) {
    if (gs) {
      g = LRTable.lr0_closure(gs, add_count)
      s['$end'] = g
    } else {
      s['$end'] = gs
    }
  }
  return g
}

LRTable.add_lalr_lookaheads = (grammar, C, add_count, cidhash, goto_cache) => {
  let nullable = LRTable.compute_nullable_nonterminals(grammar)
  let trans = LRTable.find_nonterminal_transitions(grammar, C)
  let readsets = LRTable.compute_read_sets(
    grammar,
    C,
    trans,
    nullable,
    add_count,
    cidhash,
    goto_cache
  )
  let [lookd, included] = LRTable.compute_lookback_includes(
    grammar,
    C,
    trans,
    nullable,
    add_count,
    cidhash,
    goto_cache
  )
  let followsets = LRTable.compute_follow_sets(trans, readsets, included)
  LRTable.add_lookaheads(lookd, followsets)
}

LRTable.compute_nullable_nonterminals = (grammar) => {
  nullable = set()
  num_nullable = 0
  while (true) {
    for (p of grammar.productions.slice(1))
      if (p.getlength() == 0) {
        nullable.add(p.name)
        continue
      }
    var broken = false
    for (t of p.prod) {
      if (!t in nullable) {
        broken = true
        break
      }
    }
    if (!broken) {
      nullable.add(p.name)
    }
    if (nullable.length == num_nullable) {
      break
    }
    num_nullable = nullable.length
  }
  return nullable
}

LRTable.find_nonterminal_transitions = (grammar, C) => {
  var trans = [],
    idx = 0
  for (state of C)
    for (p of state) {
      if (p.lr_index < p.getlength() - 1) {
        t = (idx, p.prod[p.lr_index + 1])
        if (t[1] in grammar.nonterminals && !t in trans) {
          trans.push(t)
        }
      }
    }
  return trans
}

LRTable.compute_read_sets = (
  grammar,
  C,
  ntrans,
  nullable,
  add_count,
  cidhash,
  goto_cache
) => {
  return digraph(
    ntrans,
    (R = (x) =>
      LRTable.reads_relation(C, x, nullable, add_count, cidhash, goto_cache)),
    (FP = (x) =>
      LRTable.dr_relation(grammar, C, x, nullable, add_count, goto_cache))
  )
}

LRTable.compute_follow_sets = (ntrans, readsets, includesets) => {
  return digraph(
    ntrans,
    (R = (x) => includesets.get(x, [])),
    (FP = (x) => readsets[x])
  )
}

LRTable.dr_relation = (grammar, C, trans, nullable, add_count, goto_cache) => {
  var [state, N] = trans
  var terms = []

  var g = LRTable.lr0_goto(C[state], N, add_count, goto_cache)
  for (p of g) {
    if (p.lr_index < p.getlength() - 1) {
      a = p.prod[p.lr_index + 1]
      if (a in grammar.terminals && !a in terms) {
        terms.push(a)
      }
    }
  }
  if (state == 0 && N == grammar.productions[0].prod[0]) {
    terms.push('$end')
  }
  return terms
}

LRTable.reads_relation = (C, trans, empty, add_count, cidhash, goto_cache) => {
  rel = []
  state, (N = trans)
  g = LRTable.lr0_goto(C[state], N, add_count, goto_cache)
  j = cidhash.get(g, -1)
  for (p of g) {
    if (p.lr_index < p.getlength() - 1) {
      a = p.prod[p.lr_index + 1]
      if (a in empty) {
        rel.push((j, a))
      }
    }
  }
  return rel
}

LRTable.compute_lookback_includes = (
  grammar,
  C,
  trans,
  nullable,
  add_count,
  cidhash,
  goto_cache
) => {
  var lookdict = {},
    includedict = {}

  var dtrans = {}
  for (let key of Object.keys(trans)) {
    dtrans[key] = 1
  }

  for ([state, N] of trans) {
    lookb = []
    includes = []
    for (p of C[state]) {
      if (p.name != N) {
        continue
      }

      lr_index = p.lr_index
      j = state
      while (lr_index < p.getlength() - 1) {
        lr_index++
        t = p.prod[lr_index]

        if ((j, t) in dtrans) {
          var li = lr_index + 1,
            broken = false
          while (li < p.getlength()) {
            if (p.prod[li] in grammar.terminals) {
              break
            }
            if (!p.prod[li] in nullable) {
              broken = true
              break
            }
            li++
          }
          if (!broken) {
            includes.push((j, t))
          }
        }

        g = LRTable.lr0_goto(C[j], t, add_count, goto_cache)
        j = cidhash.get(g, -1)
      }

      for (r of C[j]) {
        if (r.name != p.name) {
          continue
        }
        if (r.getlength() != p.getlength()) {
          continue
        }
        var i = 0,
          broken = false
        while (i < r.lr_index) {
          if (r.prod[i] != p.prod[i + 1]) {
            broken = true
            break
          }
          i++
        }
        if (!broken) {
          lookb.push((j, r))
        }
      }

      for (i of includes) {
        includedict.setdefault(i, []).push((state, N))
      }
      lookdict[(state, N)] = lookb
    }
  }
  return lookdict, includedict
}

LRParser.add_lookaheads = (lookbacks, followset) => {
  for ([trans, lb] of Object.entries(lookbacks)) {
    for ([state, p] of lb) {
      var f = followset.get(trans, [])
      var laheads = p.lookaheads.setdefault(state, [])
      for (a of f) {
        if (!a in laheads) {
          laheads.push(a)
        }
      }
    }
  }
}

module.exports = {
  ParserGenerator,
  LRParser,
}
