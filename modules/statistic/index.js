var _ = require('lodash'),
  moment = require('moment'),
  Promise = require('bluebird')

module.exports ={
  models : require("./models"),
  listen : {},
  route : {},
  strategy : require('./strategy'),
  expand : function(module){
    var root = this
    if( module.statistics && module.statistics.strategy ){
      _.merge( root.strategy, module.statistics.strategy)
    }

    if( module.statistics && module.statistics.log ){
      _.forEach( module.statistics.log,function( handler, event){
        if( /^[GPD\/]/.test(event) ){
          root.route[event] ? root.route[event].push(handler) : (root.route[event]=[handler])
        }else{
          root.listen[event] ? root.listen[event].push(handler) : (root.listen[event]=[handler])
        }
      })
    }
  },
  bootstrap : {
    "function" : function(){
      this.listen = this.standardListeners( this.listen )
      this.route = this.standardRoutes( this.route )
      this.dep.bus.expand(this)
      this.dep.request.expand(this)
    },
    "order" : {"before":"request.bootstrap"}
  },
  standardListeners : function( listen ){
    var root = this
    return _.mapValues( listen, function( handlers, event ){
      return function callStatisticHandler(){
        var bus = this
        var argv = _.toArray(arguments).slice(0)
        return Promise.all(_.map(handlers, function(handler){
            if(_.isString(handler)&&root.strategy.listener[handler]) {
              //use predefined handler
              return root.strategy.listener[handler].apply(bus, [event].concat(argv))

            }else if(_.isObject( handler) && root.strategy.listener[handler.strategy]){
              //use strategy function as a constructor and then apply
              return root.strategy.listener[handler.strategy].apply(bus,handler.argv||[]).apply(bus, [event].concat(argv))

            }else{
              root.dep.logger.warn('statistic','unknown statistic handler')
            }
          }))
      }
    })
  },
  standardRoutes : function( listen ){
    var root = this
    return _.mapValues( listen, function( handlers, url ){
      return {
        "function":function(req, res, next ){
          root.dep.logger.log("statistic","log",url)

          applyNext(0)

          function applyNext( n ){
            if( !handlers[n] ){
              return next()
            }

            var applyResult = root.strategy.route[handlers[n]].call( root, url, req )
            if( applyResult && applyResult.then ){
              applyResult.finally(function(){
                applyNext(++n)
              })
            }else{
              applyNext(++n)
            }
          }

        },
        "order" : {first:true}
      }
    })
  }
}