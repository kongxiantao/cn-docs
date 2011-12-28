/*
Copyright 2011, SeaJS v1.0.0
MIT Licensed
build time: Aug 1 17:17
 */

/**
 * @fileoverview A CommonJS module loader, focused on web.
 * @author lifesinger@gmail.com (Frank Wang)
 */

/**
 * Base namespace for the framework.
 */
//seajs 为seajs框架的全局的命名空间
this.seajs = {
	//_seajs为seajs的一个备份，由标识来看是供内部调用的
	//是用来解决命名冲突的
	_seajs : this.seajs
};

/**
 * @type {string} The version of the framework. It will be replaced
 * with "major.minor.patch" when building.
 */
seajs.version = '1.0.0';

// Module status:模块的状态
//	   downloaded状态：被下载到浏览器，好像是还没有执行
//  1. downloaded - The script file has been downloaded to the browser. 

//     define()d状态：已经执行
//  2. define()d - The define() has been executed.

//     memoize()d状态：模块已经被添加到缓存的列表 ( 表示该模块已被下载，而且还被执行)
//  3. memoize()d - The module info has been added to memoizedMods.

//     require()d状态：表示该模块是可以被其它的模块调用的
//  4. require()d -  The module.exports is available.

//疑问1：define()d ，memoize()d，require()d 中括号后面的d是什么意思啊？

/**
 * The private data. Internal use only.
 */
//数据
seajs._data = {
	
	/**
	 * The configuration data.
	 */
	//配置 seajs
	config : {
		/**
		 * Debug mode. It will be turned off automatically when compressing.
		 * @const
		 */
		debug : '%DEBUG%'
	},
	
	/**
	 * Modules that have been memoize()d.
	 * { uri: { dependencies: [], factory: fn, exports: {} }, ... }
	 */
	//已经加载的模块列表
	memoizedMods : {},
	
	/**
	 * Store the module information for "real" work in the onload event.
	 */
	//将来要用到的模块的列表，已经下载，但是还没有执行
	pendingMods : [],
	
	/**
	 * Modules that are needed to load before all other modules.
	 */
	//就是seajs加载完成，首先加载的模块列表
	preloadMods : []
};

/**
 * The private utils. Internal use only.
 */
//提供供系统内部调用的方法集合
seajs._util = {};

/**
 * The inner namespace for methods. Internal use only.
 */
 
//提供供系统内部调用的函数集合
seajs._fn = {};

/**
 * @fileoverview The minimal language enhancement.
 */
//语言增强
(function (util) {
		
		var toString = Object.prototype.toString;
		var AP = Array.prototype;
		
		//是个字符串
		util.isString = function (val) {
			return toString.call(val) === '[object String]';
		};
		//是个函数
		util.isFunction = function (val) {
			return toString.call(val) === '[object Function]';
		};
		//是个数组
		util.isArray = Array.isArray || function (val) {
			return toString.call(val) === '[object Array]';
		};
		//返回某个指定字符串值在字符串中首次出现的位置
		util.indexOf = Array.prototype.indexOf ?
		function (arr, item) {
			return arr.indexOf(item);
		}
		 :
		function (arr, item) {
			for (var i = 0, len = arr.length; i < len; i++) {
				if (arr[i] === item) {
					return i;
				}
			}
			return -1;
		};
		
		//对数组中的每个元素都执行一次指定的函数（callback）。它只对数组中的非空元素执行指定的函数，没有赋值或者已经删除的元素将被忽略。
		//forEach 不会改变原有数组。
		var forEach = util.forEach = AP.forEach ?
		function (arr, fn) {
			arr.forEach(fn);
		}
		 :
		function (arr, fn) {
			for (var i = 0, len = arr.length; i < len; i++) {
				fn(arr[i], i, arr);
			}
		};
		
		//对数组中的每个元素都执行一次指定的函数（callback），并且以每次返回的结果为元素创建一个新数组。
		//它只对数组中的非空元素执行指定的函数，没有赋值或者已经删除的元素将被忽略。
		//map 不会改变原有数组。
		util.map = AP.map ?
		function (arr, fn) {
			return arr.map(fn);
		}
		 :
		function (arr, fn) {
			var ret = [];
			forEach(arr, function (item, i, arr) {
					ret.push(fn(item, i, arr));
				});
			return ret;
		};
		//对数组中的每个元素都执行一次指定的函数（callback），并且创建一个新的数组，该数组元素是所有回调函数执行时返回值为 true 的原数组元素。
		//它只对数组中的非空元素执行指定的函数，没有赋值或者已经删除的元素将被忽略，同时，新创建的数组也不会包含这些元素。
		//filter 不会改变原有数组。
		util.filter = AP.filter ?
		function (arr, fn) {
			return arr.filter(fn);
		}
		 :
		function (arr, fn) {
			var ret = [];
			forEach(arr, function (item, i, arr) {
					if (fn(item, i, arr)) {
						ret.push(item);
					}
				});
			return ret;
		};
		//当前时间
		util.now = Date.now || function () {
			return new Date().getTime();
		};
		
	})(seajs._util);

/**
 * @fileoverview The error handler.
 */
//错误处理
(function (util, data) {
		
		var config = data.config;
		
		/**
		 * The function to handle inner errors.
		 *
		 * @param {Object} o The error object.
		 */
		util.error = function (o) {
			
			// Throw errors.
			//抛出错误
			if (o.type === 'error') {
				throw 'Error occurs! ' + dump(o);
			}
			// Output debug info.
			//如果浏览器支持 console，则打印出错误。firefox，chrome都支持
			else if (config.debug && typeof console !== 'undefined') {
				console[o.type](dump(o));
			}
		};
		
		//组装 打印信息
		function dump(o) {
			var out = ['{'];
			
			for (var p in o) {
				if (typeof o[p] === 'number' || typeof o[p] === 'string') {
					out.push(p + ': ' + o[p]);
					out.push(', ');
				}
			}
			out.pop();
			out.push('}');
			
			return out.join('');
		}
		
	})(seajs._util, seajs._data);

/**
 * @fileoverview The utils for the framework.
 */

//框架的工具集

(function (util, data, global) {
		
		var config = data.config;
		
		/**
		 * Extracts the directory portion of a path.
		 * dirname('a/b/c.js') ==> 'a/b/'
		 * dirname('d.js') ==> './'
		 * @see http://jsperf.com/regex-vs-split/2
		 */
		//获得资源文件所在的目录
		function dirname(path) {
			var s = path.match(/.*(?=\/.*$)/);
			return (s ? s[0] : '.') + '/';
		}
		
		/**
		 * Canonicalizes a path.
		 * realpath('./a//b/../c') ==> 'a/c'
		 */
		//获得文件的真实路径
		function realpath(path) {
			// 'file:///a//b/c' ==> 'file:///a/b/c'
			// 'http://a//b/c' ==> 'http://a/b/c'
			path = path.replace(/([^:\/])\/+/g, '$1\/');
			
			// 'a/b/c', just return.
			if (path.indexOf('.') === -1) {
				return path;
			}
			
			var old = path.split('/');
			var ret = [],
			part,
			i = 0,
			len = old.length;
			
			for (; i < len; i++) {
				part = old[i];
				if (part === '..') {
					if (ret.length === 0) {
						util.error({
								message : 'invalid path: ' + path,
								type : 'error'
							});
					}
					ret.pop();
				} else if (part !== '.') {
					ret.push(part);
				}
			}
			
			return ret.join('/');
		}
		
		/**
		 * Normalizes an url.
		 */
		//规范 url，也就是请求的地址。
		//seajs请求js文件的推荐做法是地址中不带后缀名的，然后在这里给地址统一加上上后缀名。
		//特别说明：请求css的文件必须添加后缀命。
		function normalize(url) {
			url = realpath(url);
			
			// Adds the default '.js' extension except that the url ends with #.
			if (/#$/.test(url)) {
				url = url.slice(0, -1);
			} else if (url.indexOf('?') === -1 && !/\.(?:css|js)$/.test(url)) {
				url += '.js';
			}
			
			return url;
		}
		
		/**
		 * Parses alias in the module id. Only parse the prefix and suffix.
		 */
		//解析 别名
		function parseAlias(id) {
			var alias = config['alias'];
			
			var parts = id.split('/');
			var last = parts.length - 1;
			
			parse(parts, 0);
			
			//要是没有斜杠
			if (last){
				parse(parts, last);
			}
				
			
			function parse(parts, i) {
				// i = 0 取第一个斜杠前的字符串
				var part = parts[i];
				if (alias && alias.hasOwnProperty(part)) {
					parts[i] = alias[part];
				}
			}
			
			return parts.join('/');
		}
		
		/**
		 * Maps the module id.
		 */
		//解析 映射
		//例如添加时间戳 ：[ [ /^(.*\.(?:css|js))(.*)$/i, '$1?20110801' ] 	  ]
		function parseMap(url) {
			// config.map: [[match, replace], ...]
			
			util.forEach(config['map'], function (rule) {
					if (rule && rule.length === 2) {
						url = url.replace(rule[0], rule[1]);
					}
				});
			
			return url;
		}
		
		/**
		 * Gets the host portion from url.
		 */
		//获取主机
		//http://www.domain.com/test/demo/demo.xxx -->http://www.domain.com
		function getHost(url) {
			return url.replace(/^(\w+:\/\/[^/]*)\/?.*$/,'$1');
		}
		
		/*
		* eg:
		* url : http://www.w3school.com.cn/js/jsref_obj_array.asp
		* loc.protocol : http
		* loc.host : www.w3school.com.cn
		* loc.pathname : /js/jsref_obj_array.asp
		*/
		
		var loc = global['location'];
		var pageUrl = loc.protocol + '//' + loc.host + loc.pathname;
		
		// local file in IE: C:\path\to\xx.js
		if (pageUrl.indexOf('\\') !== -1) {
			pageUrl = pageUrl.replace(/\\/g, '/');
		}
		
		//记录那些ID已经被转化为uri
		var id2UriCache = {};
		
		/**
		 * Converts id to uri.
		 * @param {string} id The module id. 模块的ID
		 * @param {string=} refUrl The referenced uri for relative id. 
		 *                  相对ID引用的url，奥就是说，要是相对的地址的时候，的给出参照物的地址，这个refUrl就是参照物的地址
		 * @param {boolean=} noAlias When set to true, don't pass alias. 有没有别名，要是有就得处理
		 */
		//把id转化为uri
		
		function id2Uri(id, refUrl, noAlias) {
			// only run once.
			//同一个ID就转化一次
			if (id2UriCache[id]) {
				return id;
			}
			//处理别名
			if (!noAlias && config['alias']) {
				id = parseAlias(id);
			}
			refUrl = refUrl || pageUrl;
			
			var ret;
			
			//以下分好几种情况来处理
			
			// absolute id
			if (id.indexOf('://') !== -1) {
				ret = id;
			}
			// relative id
			else if (id.indexOf('./') === 0 || id.indexOf('../') === 0) {
				// Converts './a' to 'a', to avoid unnecessary loop in realpath.
				id = id.replace(/^\.\//, '');
				ret = dirname(refUrl) + id;
			}
			// root id
			else if (id.indexOf('/') === 0) {
				ret = getHost(refUrl) + id;
			}
			// top-level id
			else {
				ret = getConfigBase() + '/' + id;
			}
			
			ret = normalize(ret);
			if (config['map']) {
				ret = parseMap(ret);
			}
			
			id2UriCache[ret] = true;
			return ret;
		}
		
		//获得base路径
		function getConfigBase() {
			if (!config.base) {
				util.error({
						message : 'the config.base is empty',
						from : 'id2Uri',
						type : 'error'
					});
			}
			return config.base;
		}
		
		/**
		 * Converts ids to uris.
		 * @param {Array.<string>} ids The module ids.
		 * @param {string=} refUri The referenced uri for relative id.
		 */
		//把一组ID 转化为一组 uri
		function ids2Uris(ids, refUri) {
			return util.map(ids, function (id) {
					return id2Uri(id, refUri);
				});
		}
		
		//把模块的信息 存储到缓存列表 memoizedMods
		var memoizedMods = data.memoizedMods;
		
		/**
		 * Caches mod info to memoizedMods.
		 */
		//缓存模块信息
		function memoize(id, url, mod) {
			var uri;
			
			// define('id', [], fn)
			if (id) {
				uri = id2Uri(id, url, true);
			} else {
				uri = url;
			}
			//模块的依赖列表
			mod.dependencies = ids2Uris(mod.dependencies, uri);
			//缓存该模块，以后就不用在在加载该模块了
			memoizedMods[uri] = mod;
			
			// guest module in package
			// 这里在做什么，没有看明白？
			if (id && url !== uri) {
				var host = memoizedMods[url];
				if (host) {
					augmentPackageHostDeps(host.dependencies, mod.dependencies);
				}
			}
		}
		
		/**
		 * Set mod.ready to true when all the requires of the module is loaded.
		 */
		//更改 缓存列表中 uris状态，已经加载完成
		function setReadyState(uris) {
			util.forEach(uris, function (uri) {
					if (memoizedMods[uri]) {
						memoizedMods[uri].ready = true;
					}
				});
		}
		
		/**
		 * Removes the "ready = true" uris from input.
		 */
		//获得缓存列表中 还没有加载成功的 uris
		function getUnReadyUris(uris) {
			return util.filter(uris, function (uri) {
					var mod = memoizedMods[uri];
					return !mod || !mod.ready;
				});
		}
		
		/**
		 * if a -> [b -> [c -> [a, e], d]]
		 * call removeMemoizedCyclicUris(c, [a, e])
		 * return [e]
		 */
		//字面意思是移除uri的依赖列表中还在等待的uris ，有点明白了，就是在处理循环依赖。
		//疑问2. c -> [a, e], d] 和 c -> a,e,d，都是依赖，有什么区别啊？
		//疑问3.这里的循环依赖具体是怎么处理啊？
		//疑问4.这里的注释的例子的返回值为什么是 e?我认为返回值应该是 b,c,e,d
		function removeCyclicWaitingUris(uri, deps) {
			return util.filter(deps, function (dep) {
					return !isCyclicWaiting(memoizedMods[dep], uri);
				});
		}
		
		function isCyclicWaiting(mod, uri) {
			//模块未定义或者已经加载成功
			if (!mod || mod.ready) {
				return false;
			}
			
			var deps = mod.dependencies || [];
			if (deps.length) {
				//依赖列表中包含 uri
				if (util.indexOf(deps, uri) !== -1) {
					return true;
				//反之
				} else {
					for (var i = 0; i < deps.length; i++) {
						if (isCyclicWaiting(memoizedMods[deps[i]], uri)) {
							return true;
						}
					}
					return false;
				}
			}
			return false;
		}
		
		/**
		 * For example:
		 *  sbuild host.js --combo
		 *   define('./host', ['./guest'], ...)
		 *   define('./guest', ['jquery'], ...)
		 * The jquery is not combined to host.js, so we should add jquery
		 * to host.dependencies
		 */
		function augmentPackageHostDeps(hostDeps, guestDeps) {
			util.forEach(guestDeps, function (guestDep) {
					if (util.indexOf(hostDeps, guestDep) === -1) {
						hostDeps.push(guestDep);
					}
				});
		}
		
		util.dirname = dirname;
		
		util.id2Uri = id2Uri;
		util.ids2Uris = ids2Uris;
		
		util.memoize = memoize;
		util.setReadyState = setReadyState;
		util.getUnReadyUris = getUnReadyUris;
		util.removeCyclicWaitingUris = removeCyclicWaitingUris;
		
		if (data.config.debug) {
			util.realpath = realpath;
			util.normalize = normalize;
			util.parseAlias = parseAlias;
			util.getHost = getHost;
		}
		
	})(seajs._util, seajs._data, this);

/**
 * @fileoverview DOM utils for fetching script etc.
 */
//DOM 处理工具集
(function (util, data) {
		
		var head = document.getElementsByTagName('head')[0];
		var isWebKit = navigator.userAgent.indexOf('AppleWebKit') !== -1;
		
		//获得资源
		util.getAsset = function (url, callback, charset) {
			var isCSS = /\.css(?:\?|$)/i.test(url);
			var node = document.createElement(isCSS ? 'link' : 'script');
			if (charset)
				node.setAttribute('charset', charset);
			
			assetOnload(node, function () {
					if (callback)
						callback.call(node);
					if (isCSS)
						return;
					
					// Don't remove inserted node when debug is on.
					if (!data.config.debug) {
						try {
							// Reduces memory leak.
							if (node.clearAttributes) {
								node.clearAttributes();
							} else {
								for (var p in node)
									delete node[p];
							}
						} catch (x) {}
						head.removeChild(node);
					}
				});
			
			if (isCSS) {
				node.rel = 'stylesheet';
				node.href = url;
				head.appendChild(node); // keep order
			} else {
				node.async = true;
				node.src = url;
				head.insertBefore(node, head.firstChild);
			}
			
			return node;
		};
		
		// 加载资源文件
		function assetOnload(node, callback) {
			if (node.nodeName === 'SCRIPT') {
				scriptOnload(node, cb);
			} else {
				styleOnload(node, cb);
			}
			
			var timer = setTimeout(function () {
						cb();
						util.error({
								message : 'time is out',
								from : 'getAsset',
								type : 'warn'
							});
					}, data.config.timeout);
			
			function cb() {
				cb.isCalled = true;
				callback();
				clearTimeout(timer);
			}
		}
		
		
		//说明：在加载js和css的时候，各个浏览器判断是否加载成功不一样，导致这里的代码看着有点复杂，这里的大部分代码是在处理浏览器兼容
		
		//加载js文件
		function scriptOnload(node, callback) {
			if (node.addEventListener) {
				node.addEventListener('load', callback, false);
				node.addEventListener('error', callback, false);
				// NOTICE: Nothing will happen in Opera when the file status is 404. In
				// this case, the callback will be called when time is out.
			} else { // for IE6-8
				node.attachEvent('onreadystatechange', function () {
						var rs = node.readyState;
						if (rs === 'loaded' || rs === 'complete') {
							callback();
						}
					});
			}
		}
		// 加载css文件
		function styleOnload(node, callback) {
			// for IE6-9 and Opera
			if (node.attachEvent) {
				node.attachEvent('onload', callback);
				// NOTICE:
				// 1. "onload" will be fired in IE6-9 when the file is 404, but in
				// this situation, Opera does nothing, so fallback to timeout.
				// 2. "onerror" doesn't fire in any browsers!
			}
			// polling for Firefox, Chrome, Safari
			else {
				setTimeout(function () {
						poll(node, callback);
					}, 0); // for cache
			}
		}
		
		function poll(node, callback) {
			if (callback.isCalled) {
				return;
			}
			
			var isLoaded = false;
			
			if (isWebKit) {
				if (node['sheet']) {
					isLoaded = true;
				}
			}
			// for Firefox
			else if (node['sheet']) {
				try {
					if (node['sheet'].cssRules) {
						isLoaded = true;
					}
				} catch (ex) {
					if (ex.name === 'NS_ERROR_DOM_SECURITY_ERR') {
						isLoaded = true;
					}
				}
			}
			
			if (isLoaded) {
				// give time to render.
				setTimeout(function () {
						callback();
					}, 1);
			} else {
				setTimeout(function () {
						poll(node, callback);
					}, 1);
			}
		}
		
		util.assetOnload = assetOnload;
		
		var interactiveScript = null;
		
		//字面意思是获得一个可交互的脚本,不明白作者在这里是在做什么。
		//疑问5：或者说他的作用是什么?
		util.getInteractiveScript = function () {
			if (interactiveScript && interactiveScript.readyState === 'interactive') {
				return interactiveScript;
			}
			
			var scripts = head.getElementsByTagName('script');
			
			for (var i = 0; i < scripts.length; i++) {
				var script = scripts[i];
				if (script.readyState === 'interactive') {
					interactiveScript = script;
					return script;
				}
			}
			
			return null;
		};
		
		//获得脚本文件的绝对地址
		util.getScriptAbsoluteSrc = function (node) {
			return node.hasAttribute ? // non-IE6/7
			node.src :
			// see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
			node.getAttribute('src', 4);
		};
		
		//时间戳
		var noCacheTimeStamp = 'seajs-ts=' + util.now();
		
		//添加时间戳
		util.addNoCacheTimeStamp = function (url) {
			return url + (url.indexOf('?') === -1 ? '?' : '&') + noCacheTimeStamp;
		};
		// 移除时间戳
		util.removeNoCacheTimeStamp = function (url) {
			var ret = url;
			if (url.indexOf(noCacheTimeStamp) !== -1) {
				ret = url.replace(noCacheTimeStamp, '').slice(0, -1);
			}
			return ret;
		};
		
	})(seajs._util, seajs._data);

/**
 * references:
 *  - http://lifesinger.org/lab/2011/load-js-css/
 *  - ./test/issues/load-css/test.html
 */

/**
 * @fileoverview Loads a module and gets it ready to be require()d.
 */
//加载模块
(function (util, data, fn, global) {
		
		/**
		 * Modules that are being downloaded.
		 * { uri: scriptNode, ... }
		 */
		 //要动态抓取的模块的列表
		var fetchingMods = {};
		//模块的缓存列表
		var memoizedMods = data.memoizedMods;
		
		/**
		 * Loads modules to the environment.
		 * @param {Array.<string>} ids An array composed of module id.	一组ID
		 * @param {function(*)=} callback The callback function. 
		 * @param {string=} refUrl The referenced uri for relative id. 	参考路径
		 */
		fn.load = function (ids, callback, refUrl) {
			if (util.isString(ids)) {
				ids = [ids];
			}
			var uris = util.ids2Uris(ids, refUrl);
			
			provide(uris, function () {
					var require = fn.createRequire({
								uri : refUrl
							});
					
					var args = util.map(uris, function (uri) {
								return require(uri);
							});
					
					if (callback) {
						callback.apply(global, args);
					}
				});
		};
		
		/**
		 * Provides modules to the environment.提供模块的环境
		 * @param {Array.<string>} uris An array composed of module uri.
		 * @param {function()=} callback The callback function.
		 */
		function provide(uris, callback) {
			//获得缓存列表中 还没有加载成功的 uris
			var unReadyUris = util.getUnReadyUris(uris);
			
			if (unReadyUris.length === 0) {
				return onProvide();
			}
			
			for (var i = 0, n = unReadyUris.length, remain = n; i < n; i++) {
			
				(function (uri) {
						//缓存列表里面有的则加载缓存列表里面的模块
						if (memoizedMods[uri]) {
							onLoad();
						} 
						//反之则现抓取
						else {
							fetch(uri, onLoad);
						}
						
						function onLoad() {
							var deps = (memoizedMods[uri] || 0).dependencies || [];
							var m = deps.length;
							
							if (m) {
								// if a -> [b -> [c -> [a, e], d]]
								// when use(['a', 'b'])
								// should remove a from c.deps
								//疑问6：为什么 should remove a from c.deps?
								deps = util.removeCyclicWaitingUris(uri, deps);
								m = deps.length;
							}
							
							if (m) {
								remain += m;
								provide(deps, function () {
										remain -= m;
										if (remain === 0)
											onProvide();
									});
							}
							if (--remain === 0){
								onProvide();
							}
								
						}
						
					})(unReadyUris[i]);
					
			}
			//所有的uri都加载成功
			function onProvide() {
				util.setReadyState(unReadyUris);
				callback();
			}
		}
		
		/**
		 * Fetches a module file.
		 * @param {string} uri The module uri.
		 * @param {function()} callback The callback function.
		 */
		function fetch(uri, callback) {
			
			if (fetchingMods[uri]) {
				util.assetOnload(fetchingMods[uri], cb);
			} else {
				// See fn-define.js: "uri = data.pendingModIE" 
				// 疑问7：pendingModIE 的作用是什么？
				data.pendingModIE = uri;
				
				fetchingMods[uri] = util.getAsset(
						getUrl(uri),
						cb,
						data.config.charset);
				
				data.pendingModIE = null;
			}
			
			function cb() {
				
				if (data.pendingMods) {
					//把 pendingMods 添加到缓存列表
					util.forEach(data.pendingMods, function (pendingMod) {
							util.memoize(pendingMod.id, uri, pendingMod);
						});
					
					data.pendingMods = [];
				}
				
				if (fetchingMods[uri]) {
					delete fetchingMods[uri];
				}
				
				if (!memoizedMods[uri]) {
					util.error({
							message : 'can not memoized',
							from : 'load',
							uri : uri,
							type : 'warn'
						});
				}
				
				if (callback) {
					callback();
				}
			}
		}
		
		function getUrl(uri) {
			var url = uri;
			
			// When debug is 2, a unique timestamp will be added to each URL.
			// This can be useful during testing to prevent the browser from
			// using a cached version of the file.
			if (data.config.debug == 2) {
				url = util.addNoCacheTimeStamp(url);
			}
			
			return url;
		}
		
	})(seajs._util, seajs._data, seajs._fn, this);

/**
 * @fileoverview Module Constructor.
 */
// 模块的构造方法
(function (fn) {
		
		/**
		 * Module constructor.
		 * @constructor
		 * @param {string=} id The module id.
		 * @param {Array.<string>|string=} deps The module dependencies.
		 * @param {function()|Object} factory The module factory function.
		 */
		fn.Module = function (id, deps, factory) {
			
			this.id = id;
			this.dependencies = deps || [];
			this.factory = factory;
			
		};
		
	})(seajs._fn);

/**
 * @fileoverview Module authoring format.
 */
//定义一个模块
(function (util, data, fn) {
		
		/**
		 * Defines a module.
		 * @param {string=} id The module id. 标识号
		 * @param {Array.<string>|string=} deps The module dependencies. 依赖模块列表
		 * @param {function()|Object} factory The module factory function. 处理函数
		 */
		//定义一个模块
		fn.define = function (id, deps, factory) {
			
			// define(factory)
			if (arguments.length === 1) {
				factory = id;
				if (util.isFunction(factory)) {
					//获取依赖列表
					deps = parseDependencies(factory.toString());
				}
				id = '';
			}
			// define([], factory)
			else if (util.isArray(id)) {
				factory = deps;
				deps = id;
				id = '';
			}
			//new一个新的模块
			var mod = new fn.Module(id, deps, factory);
			var url;
			
			//这里应该是IE的一个Hack吧
			if (document.attachEvent && !window.opera) {
				// For IE6-9 browsers, the script onload event may not fire right
				// after the the script is evaluated. Kris Zyp found that it
				// could query the script nodes and the one that is in "interactive"
				// mode indicates the current script. Ref: http://goo.gl/JHfFW
				var script = util.getInteractiveScript();
				if (script) {
					url = util.getScriptAbsoluteSrc(script);
					// remove no cache timestamp
					if (data.config.debug == 2) {
						url = util.removeNoCacheTimeStamp(url);
					}
				}
				
				// In IE6-9, if the script is in the cache, the "interactive" mode
				// sometimes does not work. The script code actually executes *during*
				// the DOM insertion of the script tag, so we can keep track of which
				// script is being requested in case define() is called during the DOM
				// insertion.
				else {
					url = data.pendingModIE;
				}
				
				// NOTE: If the id-deriving methods above is failed, then falls back
				// to use onload event to get the module uri.
			}
			
			if (url) {
				util.memoize(id, url, mod);
			} else {
				// Saves information for "real" work in the onload event.
				data.pendingMods.push(mod);
			}
			
		};
		//分析code 从code中取出require(string);
		function parseDependencies(code) {
			// Parse these `requires`:
			//   var a = require('a');
			//   someMethod(require('b'));
			//   require('c');
			//   ...
			// Doesn't parse:
			//   someInstance.require(...);
			var pattern = /[^.]\brequire\s*\(\s*['"]?([^'")]*)/g;
			var ret = [],
			match;
			
			code = removeComments(code);
			while ((match = pattern.exec(code))) {
				if (match[1]) {
					ret.push(match[1]);
				}
			}
			
			return ret;
		}
		
		// http://lifesinger.org/lab/2011/remove-comments-safely/
		//删除注释
		function removeComments(code) {
			return code
			.replace(/(?:^|\n|\r)\s*\/\*[\s\S]*?\*\/\s*(?:\r|\n|$)/g, '\n')
			.replace(/(?:^|\n|\r)\s*\/\/.*(?:\r|\n|$)/g, '\n');
		}
		
	})(seajs._util, seajs._data, seajs._fn);

/**
 * @fileoverview The factory for "require".
 */
//'require' 工厂
(function (util, data, fn) {
		
		/**
		 * The factory of "require" function.
		 * @param {Object} sandbox The data related to "require" instance.
		 */
		function createRequire(sandbox) {
			// sandbox: {
			//   uri: '',
			//   deps: [],
			//   parent: sandbox
			// }
			
			function require(id) {
				//获得资源标识号
				var uri = util.id2Uri(id, sandbox.uri);
				//根据已获得的资源标识号去缓存列表里面获取模块
				var mod = data.memoizedMods[uri];
				
				// Just return null when: 为空的几种情况：
				//  1. the module file is 404. 该模块文件找不到
				//  2. the module file is not written with valid module format.该模块文件里书写的格式不符个seajs要求的格式
				//  3. other error cases. 其它的原因
				if (!mod) {
					return null;
				}
				
				// Checks cyclic dependencies.
				//检查循环依赖
				if (isCyclic(sandbox, uri)) {
					util.error({
							message : 'found cyclic dependencies',
							from : 'require',
							uri : uri,
							type : 'warn'
						});
					
					return mod.exports;
				}
				
				// Initializes module exports.
				//初始化模块的对外接口
				if (!mod.exports) {
					initExports(mod, {
							uri : uri,
							deps : mod.dependencies,
							parent : sandbox
						});
				}
				
				return mod.exports;
			}
			//异步加载
			require.async = function (ids, callback) {
				fn.load(ids, callback, sandbox.uri);
			};
			
			return require;
		}
		
		function initExports(mod, sandbox) {
			var ret;
			var factory = mod.factory;
			
			// Attaches members to module instance.
			//mod.dependencies
			mod.id = sandbox.uri;
			mod.exports = {};
			delete mod.factory; // free
			delete mod.ready; // free
			
			if (util.isFunction(factory)) {
				checkPotentialErrors(factory, mod.uri);
				ret = factory(createRequire(sandbox), mod.exports, mod);
				if (ret !== undefined) {
					mod.exports = ret;
				}
			} else if (factory !== undefined) {
				mod.exports = factory;
			}
		}
		
		//检查循环依赖
		function isCyclic(sandbox, uri) {
			if (sandbox.uri === uri) {
				return true;
			}
			if (sandbox.parent) {
				return isCyclic(sandbox.parent, uri);
			}
			return false;
		}
		//字面的意思是检查潜在的错误 也就说的正确的使用 exoprts
		function checkPotentialErrors(factory, uri) {
			if (factory.toString().search(/\sexports\s*=\s*[^=]/) !== -1) {
				util.error({
						message : 'found invalid setter: exports = {...}',
						from : 'require',
						uri : uri,
						type : 'error'
					});
			}
		}
		
		fn.createRequire = createRequire;
		
	})(seajs._util, seajs._data, seajs._fn);

/**
 * @fileoverview The configuration.
 */
//全局配置
(function (util, data, fn, global) {
		
		var config = data.config;
		
		//start================================== 设置 全局的base路径
		
		// Async inserted script.
		var loaderScript = document.getElementById('seajsnode');
		
		// Static script.
		if (!loaderScript) {
			var scripts = document.getElementsByTagName('script');
			//获取最后一个script 标签
			loaderScript = scripts[scripts.length - 1];
		}
		
		var loaderSrc = util.getScriptAbsoluteSrc(loaderScript),
		loaderDir;
		if (loaderSrc) {
			var base = loaderDir = util.dirname(loaderSrc);
			// When src is "http://test.com/libs/seajs/1.0.0/sea.js", redirect base
			// to "http://test.com/libs/"
			var match = base.match(/^(.+\/)seajs\/[\d\.]+\/$/);
			if (match) {
				base = match[1];
			}
			config.base = base;
		}
		// When script is inline code, src is empty.
		
		//end====================================
		
		//data-main 的值对应的模块，在seajs加载完成后第一个被加载
		//说明： 要是config.preloadMods的值为空，反之则先加载 config.preloadMods 个列表的值，然后在加载data-main对应的那个模块 
		config.main = loaderScript.getAttribute('data-main') || '';
		
		// The max time to load a script file.
		//加载超时时间
		config.timeout = 20000;
		
		// seajs-debug
		if (loaderDir &&
			(global.location.search.indexOf('seajs-debug') !== -1 ||
				document.cookie.indexOf('seajs=1') !== -1)) {
			config.debug = true;
			//要是在debug模式下需要提前加载的模块
			data.preloadMods.push(loaderDir + 'plugin-map');
		}
		
		/**
		 * The function to configure the framework.
		 * config({
		 *   'base': 'path/to/base',
		 *   'alias': {
		 *     'app': 'biz/xx',
		 *     'jquery': 'jquery-1.5.2',
		 *     'cart': 'cart?t=20110419'
		 *   },
		 *   'map': [
		 *     ['test.cdn.cn', 'localhost']
		 *   ],
		 *   charset: 'utf-8',
		 *   timeout: 20000, // 20s
		 *   debug: false,
		 *   main: './init'
		 * });
		 *
		 * @param {Object} o The config object.
		 */
		fn.config = function (o) {
			for (var k in o) {
				var sub = config[k];
				if (typeof sub === 'object') {
					mix(sub, o[k]);
				} else {
					config[k] = o[k];
				}
			}
			
			// Make sure config.base is absolute path.
			var base = config.base;
			if (base.indexOf('://') === -1) {
				config.base = util.id2Uri(base + '#');
			}
			
			return this;
		};
		
		function mix(r, s) {
			for (var k in s) {
				r[k] = s[k];
			}
		}
		
	})(seajs._util, seajs._data, seajs._fn, this);

/**
 * @fileoverview The bootstrap and entrances.
 */
//引导和入口
(function (host, data, fn) {
		
		var config = data.config;
		var preloadMods = data.preloadMods;
		
		/**
		 * Loads modules to the environment.
		 * @param {Array.<string>} ids An array composed of module id.
		 * @param {function(*)=} callback The callback function.
		 */
		fn.use = function (ids, callback) {
			var mod = preloadMods[0];
			if (mod) {
				// Loads preloadMods one by one, because the preloadMods
				// may be dynamically changed.
				fn.load(mod, function () {
						if (preloadMods[0] === mod) {
							//删除
							preloadMods.shift();
						}
						fn.use(ids, callback);
					});
			} else {
				fn.load(ids, callback);
			}
		};
		
		// main
		var mainModuleId = config.main;
		if (mainModuleId) {
			fn.use([mainModuleId]);
		}
		
		// Parses the pre-call of seajs.config/seajs.use/define.
		// Ref: test/bootstrap/async-3.html
		//疑问8：这一段是在做什么啊，不明白
		(function (args) {
			if (args) {
				var hash = {
					0 : 'config',
					1 : 'use',
					2 : 'define'
				};
				for (var i = 0; i < args.length; i += 2) {
					fn[hash[args[i]]].apply(host, args[i + 1]);
				}
				delete host._seajs;
			}
		})((host._seajs || 0)['args']);
		
	})(seajs, seajs._data, seajs._fn);

/**
 * @fileoverview The public api of seajs.
 */
//对外的API
(function (host, data, fn, global) {
		
		// SeaJS Loader API:
		host.config = fn.config;
		host.use = fn.use;
		
		// Module Authoring API:
		var previousDefine = global.define;
		global.define = fn.define;
		
		// For custom loader name.
		host.noConflict = function (all) {
			global.seajs = host._seajs;
			if (all) {
				global.define = previousDefine;
				host.define = fn.define;
			}
			return host;
		};
		
		// Keeps clean!
		if (!data.config.debug) {
			delete host._util;
			delete host._data;
			delete host._fn;
			delete host._seajs;
		}
		
	})(seajs, seajs._data, seajs._fn, this);
 