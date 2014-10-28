var schema = require('validate'),
  _ = require('lodash')

module.exports = function( config ){


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

        return root.fire("user.findOne", params).then( function(){
          var user = _.clone( root.data('user.findOne') )
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
        return insideBus.fire("user.create", params).then(function () {
          var user = _.clone(root.data('user.create'))
          debugger;
          console.log( "should after user created!!!!!!!!!!!!!!!", user)
          delete user.password

          root.session("user",user)
          root.data('respond.data', user)
        })
      })
    },
    'user.me' : function(){
      console.log("===========me", this.session("user"))
      this.data("respond.data", this.session("user"))
    },
    'user.logout' : function(){
      this.session("user", null)
    }
  }
}

