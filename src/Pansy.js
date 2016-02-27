/**
 * Entry file.
 */

var url = require('./url')
var clean = require('./clean')
var errHandleChecker = require('./errHandleChecker')
var extend = require('./extend')
var forEach = require('./forEach')
var map = require('./map')
var routeChecker = require('./routeChecker')
var Router = require('./Router')

var pansy = {
  __hasInit: false,
  __mainAppInit: false,
  __hasPlugins: false,
  __mainApp: {},
  __pluginApps: {},
  __onpopstate: false,
  __onanchorclick: false,
  createMain: function(conf){
    if (this.__mainAppInit) return this.__mainApp
    pansy.__mainAppInit = true
    return this.__mainApp = createApp(conf)
  },
  createPlugin: function(conf){
    this.__hasPlugins = true
    if (typeof this.__pluginApps[conf.pluginName] != 'undefined') {
      return this.__pluginApps[conf.pluginName]
    }
    conf.isPlugin = true
    this.__pluginApps[conf.pluginName] = createApp(conf)
    return this.__pluginApps[conf.pluginName]
  }
}

// alias
pansy.Plugin = pansy.createPlugin
pansy.Main = pansy.createMain
pansy.Master = pansy.createMain
pansy.Router = pansy.Router = Router


function init() {
  if (pansy.__hasInit) return false
  pansy.__hasInit = true
  if(typeof window.onpopstate != 'undefined') {
    window.addEventListener('popstate', popstateHandle, false)
  }

  if (typeof document.addEventListener != 'undefined') {
    document.addEventListener('click', anchorClickHandle, false)
  } else if (typeof document.attachEvent != 'undefined') {
    document.attachEvent('onclick', anchorClickHandle)
  } else {
    document.onclick = anchorClickHandle;
  }
}

function popstateHandle(event) {
  if (pansy.__mainAppInit) {
    var app = pansy.__mainApp
    if (app.state.spa) {
      if (url(app.state.curUrl).beforeHash() != url(location.href).beforeHash()){
        // 拿到处理权
        app.go(location.href, 'replace')
      }
      // 交出处理权
    }
  }
}

function anchorClickHandle (event) {
  if (pansy.__mainAppInit) {
    if (pansy.__mainApp.state.spa){
      closestHref(event.target)
    }
  } else if (pansy.__hasPlugins){
    closestHref(event.target)
  }

  /**
   * Find closest anchor href.
   * @param dom
   * @api private
   */
  function closestHref(dom) {
    if (dom != document.body && dom != null) {
      if (dom.nodeName == 'A') {
        if (typeof dom.attributes.href != 'undefined') {
          // 处理链接
          var value = dom.attributes.href.value
          hrefHandle(value)
          hashHandle(value)
        }
        // 递归结束, 交出处理权
      } else {
        closestHref(dom.parentNode)
      }
    }
    // 结束递归, 交出处理权
  }

  function hrefHandle(value) {
    if (value.substr(0,1) != '#') {
      // 不是以#开头的, 判断链接是否一样
      // 如果链接一样, 判断是不是文件协议开头的,如果是,直接获取处理权!!!
      // 如果不是, 阻止页面刷新!!!
      // (所以只要链接一样, 肯定阻止跳转事件发生)
      // 如果链接不一样, 判断是不是因为hash的缘故,
      // 如果是因为hash不一样,判断是不是新链接没有hash,
      // 如果是hash清空了, 为了防止浏览器默认的刷新处理, 阻止刷新事件!!!
      // 如果不是因为hash,而是url真的变了, 判断是不是要跳转到外站(第三方站点)
      // 如果不是,那就拿到处理权,开始处理
      // 如果是的,那就继续处理
      if (url(location.href).href == url(value).href) {
        getRight(value)
      } else if(url(location.href).beforeHash() == url(value).beforeHash()) {
        if (url(value).hash == '') {
          event.preventDefault()
          console.log('为了防止浏览器默认的刷新处理')
        }
      } else if (url(location.href).origin() == url(value).origin()) {
        getRight(value)
      }
    }
  }

  /**
   * 凡是hash发生变化的清空,都单独处理
   * @param value
   */
  function hashHandle(value){
    var hash = url(value).hash
    if (url(value).hash != '') {
      var hashes = hash.split('/')
      if (hashes.length>1) {
        if (typeof pansy.__pluginApps[hashes[1]] != 'undefined'){
          event.preventDefault()
          pansy.__pluginApps[hashes[1]].go(value, 'replace')
        }
      }
    }
  }

  // 拿到处理权,并跳转
  function getRight(value){
    event.preventDefault()
    console.info('开始解析:' + value)
    pansy.__mainApp.go(value, 'push')
  }

}

function createApp(conf) {

  // 初始化
  var templateApp = {
    // 状态
    state: {
      isPlugin: false,
      complete: true,
      prevUrl: null,
      curUrl: location.href,
      timeout: 60000, // 一分钟
      mode: false,
      routeQuery: null, //默认
      routeScope: '',
      spa: false,
      protocol: null
    },

    stack: [],

    set: function (name, value) {
      var app = this

      if (typeof value != 'undefined') {
        app.state[name] = value
      }
      return app.state[name].toString() || undefined
    },

    /**
     * Add middleware for app.
     * @param path
     * @param fn
     * @api public
     */
    use: function() {

      var app = this

      if (arguments.length == 1){

        // 注册普通中间件
        if ( typeof arguments[0] === 'function'){
          var middleware = {
            fn: arguments[0],
          }
          middleware.isErrorHandle = errHandleChecker(middleware.fn)
          app.stack.push(middleware)

          // 注册模块
        } else if (arguments[0] instanceof Array) {

          var arr = arguments[0]

          map(arr, function(item, index){
            if (typeof item === 'function'){
              app.use(item)
            } else if (item instanceof Array && item.length ==2) {
              app.use(item[0], item[1])
            } else {
              console.warn('use参数有误')
              console.warn(item)
            }
          })

          //注册模块
        } else if (arguments[0] instanceof Object) {

          if (arguments[0].__stack instanceof Array) {
            app.use(arguments[0].__stack)
          } else {
            console.warn('use router 时参数有误')
          }
        } else {
          console.warn('use参数异常')
        }
      } else if (arguments.length == 2 ) {

        var path = arguments[0]

        if (path instanceof Array) {
          path = new RegExp('(^'+path.join('$)|(^')+'$)')
        } else if (typeof path == 'string') {
          path = new RegExp('^'+path+'$')
        }

        if (!path instanceof RegExp) {
          console.error('route参数错误: '+path)
        }

        app.stack.push({
          fn: arguments[1],
          path: path,
          isErrorHandel: errHandleChecker(arguments[1])
        })

      }

    },

    /**
     * Router
     **/
    route: function(path) {
      var app = this
      return {
        get: function(){
          var fns = Array.prototype.slice.call(arguments,0)
          map(fns, function(fn, index){
            app.use(path, fn)
          })
        }
      }
    },

    /**
     * Core method. Change the route state.
     * @param {string} rawUrl
     * @param {string} type
     * @api public
     */
    go: function (rawUrl, type){

      init()

      var app = this
      if (!app.state.complete) return false
      app.state.complete = false

      /**
       * 获取解析后的url对象
       */
      var parsedUrl = url(rawUrl||location.href).all()
      var filterPath = '/'

      if (app.state.isPlugin) {
        if (rawUrl.length > 0) {
          if (rawUrl.match(new RegExp('^#/'+app.state.pluginName))){
            filterPath = rawUrl.substring(app.state.pluginName.length+2) || '/'
          }
        }
      } else if (app.state.routeQuery){
        filterPath = parsedUrl.query[app.state.routeQuery] || '/'
      } else {
        if(parsedUrl.pathname.match(new RegExp('^'+app.state.routeScope))){
          filterPath = parsedUrl.pathname.substr(app.state.routeScope.length) || '/'
        }
        parsedUrl.params = clean(filterPath.replace(/^\//,'').split('/'),'')
      }
      parsedUrl.filterPath = filterPath

      console.info('请求地址: '+parsedUrl.filterPath)

      /**
       * 封装请求
       */
      var req = extend(parsedUrl, {
        routed: false,
        expire: new Date().getTime() + app.state.timeout,
        conf: app.state,
        state: app.state,
        locals: {},
        historyStateType: type|| 'push' // 堆栈方式,默认是push
      })

      /**
       * 封装响应处理
       */
      var res = {
        end: function () {
          end = true
          app.state.complete = true
          app.state.errorStack = null
          //clearTimeout(t)
          console.info('请求结束')
          if (app.state.spa && app.state.protocol != 'file:') {
            if (req.historyStateType == 'replace') {
              console.info('spa: true, history replace '+req.rawUrl)
              history.replaceState('data', 'title', req.rawUrl)
            } else {
              console.info('spa: true, history push '+req.rawUrl)
              history.pushState('data', 'title', req.rawUrl)
            }
          }

        },

        redirect: function(rawUrl) {
          res.end()
          console.info('重定向到: '+rawUrl)
          if (app.state.spa){
            app.go(rawUrl, 'replace')
          } else {
            location.href = rawUrl
          }
        }
      }

      /**
       * 开始执行
       */
      var end = false
      //var errorStack = null
      var index = -1
      next()

      /**
       * 流程控制
       */
      function next(err) {

        index ++

        // 检查指针
        if(index >= app.stack.length) {
          // 流程结束, 收尾
          // 错误检查
          if (err) console.error(err)
          // 404 检查
          if (!req.routed) console.error('404 not found')
          return res.end()
        }

        // 错误堆栈
        //errorStack = err || null
        // 检查是否有错误要处理
        if (err){
          // 有错误
          // 跳过普通中间件, 找到错误处理中间件处理错误
          if (!app.stack[index].isErrorHandle) return next(err)
          // 错误处理中间件
          return app.stack[index].fn(err, req, res, next)
        }

        if (app.stack[index].isErrorHandle) return next()

        // 检查失效层
        if (typeof app.stack[index].disabled != 'undefined') return next()

        // 检查路由
        if (typeof app.stack[index].path != 'undefined') {
          // 不匹配
          if (!routeChecker(req, app.stack[index].path)) return next()
          // 匹配
          run()
          return req.routed = true
        }

        // 通用中间件
        run()

        function run(){
          try{
            app.stack[index].fn(req, res, next)
          } catch(e){
            console.log(e)
            if (e) next(e)
          }
        }

      }
    }

  }

  templateApp.state = extend(templateApp.state, conf)
  return templateApp
}


/**
 * 判断请求的url应该使用哪个app
 */
function checkApp(url){
  // todo
}


module.exports = pansy