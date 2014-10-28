var _ = require('lodash'),
  colors = require('colors')

/**
 * 该模块负责自动将 bus.data('respond') 中的数据输出到浏览器端。
 * @module respond
 */
var respondModule = {
  route : {
    "*" : {
      "function" :function respondHandler( req, res, next){
//        if( req.isAgent && !req.isFirstAgent) return next && next()
        var logger = respondModule.dep.logger
        logger.log("respond","<====== respond default handler take action","isAgent:",req.isAgent)

        //must wait all result resolved!
        req.bus.then(function(){
          logger.log("respond","respond bus.then execute ")
            var respond = req.bus.data('respond')

            if( !respond ){
              logger.log("respond"," NOTHING HAPPENED", req.bus._id )
              res.status(404).send("404")
            }else{

              if( respond.file ){
                return req.bus.fire('respond.file.before', respond).then(function(){
                  logger.log("respond","file ======>".cyan,respond.file)
                  res.sendFile( respond.file)
                })
              }else if( respond.page ){
                return req.bus.fire('respond.page.before', respond).then(function() {
                  logger.log("respond","page ======>".blue,respond.page, JSON.stringify(Object.keys(respond.data)))
                  res.render(respond.page, respond.data || {})
                })
              }else{
                return req.bus.fire('respond.data.before', respond).then(function() {
                  logger.log("respond","data ======>".green,Object.keys(respond.data).join(","))
                  res.json(respond.data || {})
                })
              }
            }
        }).catch(function( err ){
          logger.error("respond last handler error",err)
          res.status(err.status || 500).json({errors: req.bus.$$error })
        })

//        if(req.isAgent) next&&next()

      },
      order : {last:true}
    }
  }
}

module.exports = respondModule