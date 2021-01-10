class IdentityDict {
  construcor() {
    this._contents = {}
    this._keepalive = []
  }

  getItem(key) {
    return this._contents[id(key)][1]
  }

  setItem(key, value) {
    idx = this._keepalive.length
    this._keepalive.push(key)
    ;(this._contents[id(key)] = key), value, idx
  }

  delItem(key) {
    delete this._contents[id(key)]
    var idx = 0
    for (item of this._keepalive) {
      if (item[1] === key) {
        delete this._keepalive[item[0]]
        break
      }
      idx++
    }
  }

  contains(item) {
    return item in this._contents
  }

  get(key, value = null) {
    if (key in this._contents) {
      return this._contents[key]
    } else {
      return value
    }
  }

  get length() {
    return this._contents.length
  }

  *iter() {
    for (item of itervalues(this._contents)) {
      yield item[0]
    }
  }
}

class Counter {
  constructor() {
    this.value = 0
  }

  incr() {
    this.value++
  }
}

module.exports = {
  IdentityDict,
  Counter,
}
