var colors = require("colors"),
  _ = require("lodash")

function logFactory( color ){
  return function(){
    var module = this.relier
    var argv = _.toArray(arguments).map( function(r){
      return (color &&_.isString(r)) ? r[color] : r
    })

    argv.unshift( ( module[0].toUpperCase() + this.relier.slice(1).toLowerCase()).white+ " :: ".green )
    console.log.apply( global, argv)
  }
}

var logModule = {
  //api
  "log" : logFactory(),
  "debug" : logFactory(  "cyan"),
  "info" : logFactory(  "blue"),
  "error" : logFactory(  "red"),
  "warn" : logFactory(  "yellow")
}

module.exports = logModule