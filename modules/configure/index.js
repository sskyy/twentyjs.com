var path = require('path'),
  _ = require('lodash'),
  fse = require("fs-extra"),
  configPath = path.join(process.cwd(),'config.json')

var mergeDefaults = _.partialRight(_.merge, function(a, b){
  if( a===undefined){
    return b
  }else if(_.isArray(a) ){
    return _.uniq(a.concat(b))
  }else if(_.isObject(a)){
    //return undefined meas go merge children
    return undefined
  }else{
    return b
  }
})


var requestModule = {
  config : require(configPath),
  expand : function( module ){
    if(!module.config) return

    var root = this

    root.config[module.name] = root.config[module.name] || {}
    //this will override the default config
    mergeDefaults( root.config[module.name] , module.config )

    module.config = root.config[module.name]
  },
  bootstrap : {
    "function" : function(){
      requestModule.dep.request.add("GET /config/list", function getConfig(req, res){
        res.json( requestModule.config )
      })

      requestModule.dep.request.add("PUT /config/save", function updateConfig( req, res){
        var inputConfig = req.param("config")
        if(_.isObject( inputConfig)){
          fse.outputJson( configPath,inputConfig,function(err){
            if( err ){
              ZERO.error(err)
              return res.status(500).end()
            }
            mergeDefaults( requestModule.config, inputConfig )
            res.json(inputConfig)
          })
        }
      })
    },
    "order" : {before:"request.bootstrap"}
  }
}

module.exports = requestModule
