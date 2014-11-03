var _ = require('lodash')

function ensure(array,item){
  if(array.indexOf(item)==-1){
      array.push( item)
  }
  return array
}


var rbac = {
  models : require('./models'),
  acl : {
    roles : {},
    routes : {}
  },
  route : {},
  expand : function( module ){
    if( module.acl ){
      _.extend( rbac.acl.roles, module.acl.roles )
      //TODO different module may control same route
      _.extend( rbac.acl.routes, module.acl.routes)
    }
  },
  bootstrap : {
    "function" : function(){
      this.dep.request.add( '*', rbac.applyRoleToCurrentUser, {after:'user.initSession'})

      this.extendRoute()
      this.dep.request.expand(this)

    },
    "order" : {"before":"request.bootstrap"}
  },
  applyRoleToCurrentUser : function applyRoleToCurrentUser(req, res,next){

    var  rolesToApply = Object.keys( rbac.acl.roles )

    applyNext(0)

    function applyNext( n ){
      if( !rolesToApply[n] ){
        return next()
      }

      var applyResult = rbac.acl.roles[rolesToApply[n]]( req )
      if( applyResult && applyResult.then ){
        applyResult.then(function(){
          req.session.user.roles = req.session.user.roles || []
          ensure(req.session.user.roles, rolesToApply[n] )
        }).catch(function(err){
          if( err ) ZERO.error("rbac","apply roles error",err)
        }).finally(function(){
          applyNext(++n)
        })
      }else if(applyResult==true){
          req.session.user.roles = req.session.user.roles || []
          ensure(req.session.user.roles, rolesToApply[n] )
          applyNext(++n)
      }else{
        applyNext(++n)
      }
    }
  },
  extendRoute : function(){
    rbac.route = _.mapValues( this.acl.routes, function( rolesNeeded ){
      return {
        "function": function checkRole(req, res, next) {
          var roles = req.session.user.roles||[]
          var passed = _.every( rolesNeeded, function( role ){
            var currentRoleToCheck = _.isString( role) ? role : role.role
            if( roles.indexOf( currentRoleToCheck ) == -1){
              role.redirect ? res.redirect( role.redirect ) :  res.status(403).end()
              return false
            }
            return true
          })

          if( passed ) next()
        },
        "order" : {after:'rbac.applyRoleToCurrentUser'}
      }
    })
  }
}

module.exports = rbac