'use strict'

import { ParsingError } from "errors"

class LRParser {
  constructor(lr_table, error_handler) {
    this.lr_table = lr_table
    this.error_handler = error_handler
  }
}

module.exports = {
  LRParser,
};