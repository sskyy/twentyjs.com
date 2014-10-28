var config = require('./config')


var userModule = {
  models : require('./models'),
  listen : require('./listen')(config),
  //this will allow app global config overwrite
  config : config,
  route : {
    "/user/count" : function( req, res, next){
      userModule.dep.model.models['user'].count().then(function(total){
        res.json({count:total})
      })
    },
    "*" : {
      "function" : function initSession(req,res,next){
        //TODO only for dev
        if( !req.session.user ){
          //userModule.dep.model.models['user'].count().then(function(total){
          //  var skip = parseInt( total * Math.random())
          //  userModule.dep.model.models['user'].find({limit:1,skip:skip}).then(function(users){
          //    console.log("====================random setting session user===========", users[0].name)
          //    req.session.user = users[0]
          //    next()
          //  }).catch(function(err){
          //    ZERO.error(err)
          //    next()
          //  })
          //})
          req.session.user = req.session.user || {}
          next()
        }else{
          next()
        }




        return

//        if( req.session.user ){
//          next()
//        }else{
//          //TODO only for dev
//          userModule.dep.model.models['user'].find({limit:1}).then(function(users){
//            req.session.user = users[0]
//            next()
//          }).catch(function(err){
//            ZERO.error(err)
//            next()
//          })
//        }

      },
      "order" : {first:true}
    }

  }
}

module.exports = userModule

