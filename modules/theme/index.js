var path = require('path'),
  Promise = require('bluebird'),
  _ = require('lodash'),
  fs = require('fs'),
  appUrl  = process.cwd(),
  argv = require('optimist').argv,
  less = require('gulp-less'),
  gulp = require('gulp'),
  sourcemaps = require('gulp-sourcemaps')

function walk(dir, filter) {
  var results = [];
  var list = fs.readdirSync(dir)

  list.forEach(function(file) {
    file = dir + '/' + file;
    var stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file, filter));
    } else {
      filter( file ) && results.push(file);
    }
  });
  return results
};

function fill( length, initial ){
  return Array.apply(null, new Array(length)).map(function(){ return initial})
}

function findExtension( collection, exts, item){
  return _.find( exts, function( ext ){ return collection[item+"."+ext]})
}

function generateThemeHandler( module){
  var root = this
  var logger = root.dep.logger

  var matchRoute = path.join("/"+ module.name, (module.theme.prefix?module.theme.prefix:"")) ,
    themePath = path.join('modules',module.name, module.theme.directory )


  return function( req, res, next ){
    var restRoute = {
        url:req.path.replace( matchRoute , ""),
        method : req.param('_method') || 'get'
      },
      cachePath = path.join( appUrl, themePath, restRoute.url),
      page


    var fireParams = _.extend({},restRoute,{req:req,res:res})

    req.bus.fcall("theme.render", fireParams, function(){
      var bus = this

      //1. deal with pre-process resource files
      if( !argv.prod ){
        if( /\.css$/.test(cachePath) ){
          var lessFile =cachePath.replace(/\.css$/,".less")

          if(  root.cache[module.name].statics[lessFile] ){
            //read from less and compile
            return new Promise(function(resolve, reject){
              gulp.src(lessFile)
                .pipe(sourcemaps.init())
                .pipe(less())
                .pipe(sourcemaps.write())
                .pipe(gulp.dest(path.dirname( lessFile)))
                .on("end",function(){
                  bus.data('respond.file', cachePath)
                  resolve()
                })
                .on('error',function(){ reject()})
            })
          }
        }else{
          //TODO handle coffee files

        }
      }

      //2. deal with resource files
      if( /\.[a-zA-Z]+$/.test(cachePath) ) {
//        logger.log("THEME","find static file", cachePath)
        if(root.cache[module.name].statics[cachePath] ){
          bus.data('respond.file', cachePath)
        }
      //3. check if current view route need to mock
      }else if( page = root.findMockOption( root.mock[module.name], restRoute, themePath).template ){
        logger.log("THEME","find model match", restRoute)

        return bus.fire('request.mock', fireParams).then(function(){
          logger.log("THEME","model action done", restRoute.url)

          if( page ){
            logger.log("THEME","find template", page)
            bus.data('respond.page', page)
            //merge locals
            return getLocals.call(root, root.locals, {url:req.path,method:'get'}).then(function( locals ){
              bus.data('respond.data', locals)
              console.log( locals,bus.data('respond.data'))
            }).catch(function(e){
              console.error(e)
            })
          }else{
            logger.log("THEME"," can't find template", page)
          }
        }).catch(function(err){
          logger.error(err)
        })

      //4. check if current view route match any page
      }else if(page = root.findPage(root.cache[module.name],restRoute,themePath)){
        logger.log("THEME"," find view page match", restRoute.url)

        //deal with locals
        bus.data( 'respond.page',page )
        return getLocals.call(root, root.locals, {url:req.path,method:'get'}).then(function( locals ){
          bus.data('respond.data',locals)
        })
      }else{
        logger.log("THEME"," cannot find any match",JSON.stringify(restRoute),cachePath)
      }
    }).then(function(){
      next()
    }).catch(function(err){
      logger.error(err)
      next()
    })
  }
}

function getLocals( locals, route ){
  var root = this
  var logger = root.dep.logger

  return new Promise(function( resolve, reject){
    var matchedHandlers = root.dep.request.getRouteHandlers( route.url, route.method, locals),
      results = {}
    logger.log("theme","getLocals", route.url)

    applyNext(0)

    function applyNext( n ){
      if( !matchedHandlers[n] ){
        return resolve(results)
      }

      var applyResult = _.isFunction(matchedHandlers[n].data) ? matchedHandlers[n].data(req) : matchedHandlers[n].data
      Promise.resolve(applyResult).then(function( resolvedResult ){
        if(_.isObject(results)){
          _.merge( results, _.cloneDeep(resolvedResult))
        }
        applyNext(++n)
      })

      //if(_.isFunction( matchedHandlers[n].data)){
      //  var applyResult = matchedHandlers[n].data(req)
      //  Promise.resolve(applyResult).then(function(){
      //    applyNext(++n)
      //  })
      //}else{
      //  if(_.isPlainObject( matchedHandlers[n].data )){
      //    _.merge( results, _.cloneDeep(matchedHandlers[n].data))
      //    console.log("=============",results,"==============")
      //
      //  }
      //  applyNext(++n)
      //}

    }
  })
}


/**
 * @description
 * 为所有依赖该模块并声明了 theme 属性的模块提供主题服务。
 * 当访问的路径为 `/模块名/view/任意名字` 时，主题就开始接管，接管的规则为：
 *
 *   1. 当 `任意名字` 和某个 model 名字相同时，将触发相应的 model 方法，并将 bus.data('respond') 中的数据传给同名模板。
 *   2. 当 `任意名字` 和主题文件夹下的某个模板文件同名时，将直接渲染该模板文件。如果同时在theme.locals中声明一个同名属性，那么会将该属性的值作为数据传给模板。如果改属性值是一个函数，那么将执行该函数，然后将 bus.data('respond') 作为数据传给模板。
 *   3. 当 `任意名字` 和主题文件夹下的某个文件匹配时，直接输出该文件。
 *
 * @module theme
 *
 * @example
 * //theme 字段示例
 * {
 *  directory : 'THEME_DIRECTORY'
 * }
 *
 */
module.exports = {
  config : {
    'engines'  : ['ejs','jade']
  },
  cache : {},
  route : {},
  locals : [],
  mock : {},
  /**
   * @param module
   * @returns {boolean}
   */
  expand : function( module ){
    if( !module.theme ) return false

    var root = this,logger = root.dep.logger
    root.cache[module.name] = {}

    var matchRoute = path.join("/"+ module.name, (module.theme.prefix?module.theme.prefix:"")) ,
      themePath = path.join('modules',module.name, module.theme.directory)

    //cache all files
    var pages = walk(path.join(appUrl, themePath), function( f){ return _.indexOf(root.config.engines, f.split(".").pop()) !== -1}),
      statics = walk( path.join(appUrl, themePath), function(f){ return _.indexOf(root.config.engines, f.split(".").pop()) == -1 })

    root.cache[module.name] = {
      page: _.zipObject( pages,  fill(pages.length, true)),
      statics:_.zipObject( statics,  fill(statics.length, true))
    }

    logger.log("THEME","route",matchRoute)

    root.dep.request.add( matchRoute + "/*",generateThemeHandler.call(root,module) )

    if( module.theme.locals ){
      _.forEach( module.theme.locals, function( data, url ){
        root.locals.push(_.extend(root.dep.request.standardRoute( url ),{handler:{data:data}}))
      })
    }

    //check if there are route need mock
    if( module.theme.mock ){
      root.mock[module.name] = module.theme.mock
    }

    //set index page
    if( module.theme.index ){
      root.dep.request.add("GET /", function( req, res){
        res.redirect( module.theme.index )
      })
    }
  },
  findPage : function( cache, restRoute, themePath ){
    var root = this
    //TODO find the right view file
    var templateName, extension
    if( extension = findExtension( cache.page,root.config.engines, path.join( appUrl, themePath, restRoute.url.slice(1) ) ) ){
        //match certain files
        templateName = restRoute.url.slice(1)
    }

    return extension ? path.join( themePath, templateName) + "." +extension : false
  },
  findMockOption : function( mock, restRoute, themePath){
    var root = this,
      output = false
    _.any( Object.keys(mock), function( mockUrl ){
      var match =root.dep.request.matchUrl( restRoute.url, mockUrl)
      if( match){
        output = {mockUrl:mockUrl,match :match,template:path.join( themePath,mock[mockUrl] )}
        return true
      }
    })
    return output
  }
}

