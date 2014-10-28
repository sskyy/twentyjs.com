var path= require('path'),
  Bus = require( path.join(process.cwd(),'system/core/bus')),
  _ = require('lodash')

/**
 * 为所有其他模块提供 bus 服务。参见 Bus。
 * @module bus
 */
module.exports = {
  bus : new Bus,
  expand : function( module ){
    var root = this
    if( module.listen ){
      _.forEach(module.listen, function( listener, event){
        root.bus.module(module.name)
        root.bus.on(event, listener)
      })
    }
  },
  on : function( event, listener, moduleName ){
    var root = this
    root.bus.module(moduleName || root.relier)
    root.bus.on( event, listener)
  }
}
