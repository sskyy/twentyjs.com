var crypto = require('crypto'),
  xss = require('xss'),
  _ = require('lodash')


function generateListener( modelName, attributeName, strategy){
  var listen = {}
  _.forEach( strategy, function(func, event){
    listen[modelName+"."+event] = function( val , updateObj){
      if( val[attributeName]){
        if( /update$/.test( event)){
          updateObj[attributeName] = func(updateObj[attributeName])
        }else{
          val[attributeName] = func(val[attributeName])
        }
      }
    }
  })
  return listen
}


var securityModule= {
  listen : {},
  encrypt : function( str, encode ){
    var encode = encode || 'binary',
      hasher = crypto.createHash("md5")

    hasher.update(str);
    return hasher.digest(encode);
  },
  decrypt : function( str, encode ){

  },
  strategy: {
    encryptPermanent : {
      "create.before" : function( origin ){
        return securityModule.encrypt(origin)
      },
      "update.before" : function( origin ){
        return securityModule.encrypt(origin)
      },
      "find.before" : function( origin ){
        return securityModule.encrypt(origin)
      },
      "findOne.before" : function( origin ){
        return securityModule.encrypt(origin)
      }
    },
    xss : {
      "create.before": function (origin) {
        return xss(origin, {})
      }
    }
  },
  expand : function( module ){
    var root = this
    if( module.models ){
      _.forEach( module.models, function( model){
        _.forEach( model.security, function( strategies, attributeName){
          _.forEach( strategies, function( strategy){
            root.listen = generateListener(  model.identity, attributeName, root.strategy[strategy])
          })
        })
      })
    }
  },
  bootstrap : function(){
    securityModule.dep.bus.expand( securityModule )
  }
}

module.exports = securityModule