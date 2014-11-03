var _ = require('lodash'),
  Promise = require('bluebird')

function isPromiseAlike( obj ){
  return _.isObject(obj) && _.isFunction(obj.then) && _.isFunction(obj.catch)
}

var nodes = {},
  indexes = {}

function generateBeforeCreateCallback(indexName, nodeName, models) {
  return function handlerIndexBeforeNodeCreate(val) {

    if (!val[indexName]) return


    var index = models[indexName]
    return Promise.all( val[indexName].map(function ( inputIndex , key) {

      if( !_.isObject(inputIndex)) return

      //may need to build index
      if ( !inputIndex.id) {
        //same name check
        ZERO.mlog("index"," may create new ", inputIndex.name)
        return index.findOne({name: inputIndex.name}).then(function (i) {
          if (i) {
            ZERO.mlog("index"," not create new ", inputIndex.name)
            //to support query from browser.
            //when using `category.id=2` from browser, waterline look for key name of 'category.id' to match query
            //TODO this does not working with multiple index like `tag`
            val[indexName][key] = _.pick(i, ['id', 'name'])
            return val
          } else {
            ZERO.mlog("index"," create new ", inputIndex.name)

            return index.create(inputIndex).then(function (savedIndex) {
              //TODO provide config options to decide which field should be cached
              ZERO.mlog("index"," create new done ", inputIndex.name)

              //to support query from browser.
              //when using `category.id=2` from browser, waterline look for key name of 'category.id' to match query
              val[indexName][key] = _.pick(savedIndex, ['id', 'name'])
              return val
            })
          }
        })
      }else{
        ZERO.mlog("index"," not create new ", inputIndex.name)

        val[indexName][key] = _.pick(inputIndex, ['id', 'name'])

        //to support query from browser.
        //when using `category.id=2` from browser, waterline look for key name of 'category.id' to match query
        //val[indexName+'.id'] = index.id
        return val
      }
    }).filter( isPromiseAlike ))
  }
}

function generateAfterCreateCallback(indexName, nodeName, models) {

  return function handlerIndexAfterNodeCreate(val) {
    ZERO.mlog( "index"," after create node")

    if ( !val[indexName]) return
    var index = models[indexName]
    return Promise.all( val[indexName].map(function ( inputIndex, key) {
      //need to push nodes
      return index.findOne( inputIndex.id).then(function( foundIndex){
        var nodes = foundIndex.nodes || {}
        if( !nodes[nodeName] ) nodes[nodeName] = {}

        //TODO we need to improve this, because the 'nodes' field may grow very big
        nodes[nodeName][val.id] = _.pick(val,['id','title'])

        return index.update(foundIndex.id, {nodes: nodes})
      })
    }).filter( isPromiseAlike))
  }
}

function generateBeforeUpdateCallback(indexName,nodeName, models) {
  return function handlerIndexBeforeNodeUpdate(val) {
    ZERO.mlog( "index"," after create node")

    if (!val[indexName]) return

    //TODO: validation
//      if( indexes[indexName].config.limit ){}
    var index = models[indexName]
    return Promise.all( val[indexName].map(function (inputIndex, key) {

      if( !_.isObject(inputIndex)) return

      //may need to build index
      if ( !inputIndex.id) {
        //same name check
        return index.findOne({name: inputIndex.name}).then(function (foundIndex) {
          if (foundIndex) {

            //to support query from browser.
            //when using `category.id=2` from browser, waterline look for key name of 'category.id' to match query
            //TODO : this do not support multiple index
            val[indexName][key] = _.pick(foundIndex, ['id', 'name'])

            var nodes = foundIndex.nodes || {}
            if( !nodes[nodeName] ) nodes[nodeName] = {}

            //TODO we need to improve this, because the 'nodes' field may grow very big
            nodes[nodeName][val.id] = _.pick(val,['id','title'])

            return index.update(foundIndex.id, {nodes: nodes})

          } else {

            inputIndex.nodes = {}
            inputIndex.nodes[nodeName] = {}
            inputIndex.nodes[nodeName][val.id] = _.pick(val,['id','title'])

            return index.create(inputIndex).then(function (savedIndex) {
              //TODO provide config options to decide which field should be cached

              val[indexName][key] = _.pick(savedIndex, ['id', 'name'])

              return val
            })
          }
        }).catch(function(err){
          ZERO.error( err)
        })
      }else{
        val[indexName][key] = _.pick(index, ['id', 'name'])

        return val
      }
    }).filter( isPromiseAlike) )
  }
}

function generateBeforeModelFindHandler( indexName, nodeName, models){
  return {
    "function": function replaceTagWithNodeIds( val ){
      //TODO change find critia
      var tagKey,tagVal
      if( !val[indexName]) return

      tagKey = Object.keys( val[indexName]).pop()
      tagVal = val[indexName][tagKey].split(",")
      var critia = {where:{}}
      critia.where[tagKey] = tagVal
      var replacePromise = models[indexName].find(critia).then(function( indexes ){
        var nodeIds =[]
        _.forEach( indexes, function( index ){
          if( index.nodes[nodeName] )
            nodeIds = nodeIds.concat( Object.keys(index.nodes[nodeName]) )
        })
        nodeIds = _.uniq( nodeIds )

        val.id = nodeIds
        delete val[indexName]
      })

      replacePromise.block = true
      return replacePromise
    },
    "first" : true
  }
}

function hierarchyObject(val){
  var output = _.cloneDeep( val )
  _.forEach(output, function( v, k){
    console.log("has dot",k,k)
    if( k.indexOf(".")>0 ){
      var i= output,stack = k.split("."),n
      while( n = stack.shift() ){
        if( stack.length !== 0){
          i[n] = i[n] || {}
          i= i[n]
        }else{
          i[n] = v
        }
      }
      delete output[k]
    }
  })
  return output
}


module.exports = {
  indexes : {},
  listen : {},
  expand : function( module ){
    var root = this
    if( module.models ){
      module.models.forEach(function( model ){
        if( model.isIndex ){
          root.indexes[model.identity] = model.attributes
        }
      })
    }
  },
  bootstrap : function( ){
    var root = this

    _.forEach(root.dep.model.models, function(node, nodeName){
      if( node.isNode ){

        _.forEach( root.indexes , function( attributes, indexName ){
          root.dep.bus.on(nodeName + '.create.before',generateBeforeCreateCallback(indexName, nodeName, root.dep.model.models ))
          root.dep.bus.on(nodeName + '.create.after',generateAfterCreateCallback(indexName,nodeName ,root.dep.model.models ))
          root.dep.bus.on(nodeName + '.update.before',generateBeforeUpdateCallback(indexName,nodeName, root.dep.model.models ))
          root.dep.bus.on(nodeName + '.find',generateBeforeModelFindHandler( indexName, nodeName, root.dep.model.models ))
        })
      }
    })

  }
}

