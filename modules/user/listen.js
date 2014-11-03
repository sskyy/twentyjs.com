var schema = require('validate'),
  _ = require('lodash')

module.exports = function( config, module ){
  var validator = {
    login : schema( config.validator.login ),
    registry : schema( config.validator.registry,{strip:false})
  }

  return {
    'user.login' : function login( params ){
      var root = this
      return this.fcall('user.login',params, function(){
        console.log( "[USER]: on user.login",params )
        var errors = validator.login.validate( params )

        if( errors.length ) return root.error( 406, errors )

        return root.fire("user.findOne", params).then( function(eventResult){
          var user = _.clone( eventResult['model.findOne.user'])
          console.log( "user logged in", user)
          if( user ){
            delete user.password

            root.session("user",user)
            root.data('respond.data', user)
          }else{
            return root.error( 404, errors )
          }
        })
      })
    },
    'user.register' : function registerUser( params ){
      var root = this
      return this.fcall('user.register',params, function() {
        console.log("validating register params", params)
        var errors = validator.registry.validate(params)
        var insideBus = this

        if (errors.length) return root.error(406, errors)
        //We may verify invite code or something here
        return insideBus.fire("user.create", params).then(function (eventResult) {
          var user = _.clone( eventResult['model.create.user'])
          delete user.password

          root.session("user",user)
          root.data('respond.data', user)
        })
      })
    },
    'user.me' : function(){
      this.data("respond.data", this.session("user"))
    },
    'user.logout' : function(){
      this.session("user", null)
    }
  }
}

