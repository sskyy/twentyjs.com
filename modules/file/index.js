var _ = require('lodash'),
  path = require('path')


module.exports = {
  files : {},
  expand : function( module ){
    var root = this
    if( module.models ){
      //allow upload
      _.forEach( module.models ,function(model){
        if( model.isFile ){
          root.files[model.identity] = model

          root.dep.request.add('POST /'+model.identity, function handlerFileUpload(req,res, next){
            req.body = _.isObject( req.body) ? req.body : {}
            _.extend( req.body, _.values(req.files).pop())
            next()
          },{first:true})

          root.dep.request.add('GET /'+model.identity + "/:id/download", function handlerFileDownload( req, res, next){
            root.dep.model.models[model.identity].findOne({id:req.param('id')}).then(function( file){
              if( file ){
                return res.sendFile( path.join(process.cwd(), file.path ))
              }else{
                res.status(404).end()
              }
            })
          })
        }
      })
    }
  }
}