const { io } = require("socket.io-client");
//监听本地ws
const socket = io('/')

class Emitter {
    constructor() {
        this.listeners = {

        }
    }
    on(type, listener) {
        this.listeners[type] = listener
    }
    emit(type) {
        this.listeners[type] && this.listeners[type]()
    }
}

const hotEmitter = new Emitter()

const onConnected = () => {
    console.log('客户端链接成功');
}

let hotCurrentHash
let currentHash;
socket.on('hash', hash => {
    // 每次编译更改都更新一下hash
    currentHash = hash
})
socket.on('ok', () => {
    // 可进行刷新or热替换
    reloadApp(true)
})

hotEmitter.on('webpackHotUpdate', () => {
    if (!hotCurrentHash || hotCurrentHash === currentHash) {
        hotCurrentHash = currentHash
        return
    }
    hotCheck()
})

// 下载要更新的代码chunk信息以及对应hash
function hotCheck() {
    hotDownLoadManifest()
        .then(update => {
            // 拿到改变的chunkId
            const chunkIds = Object.keys(update.c)
            chunkIds.forEach(chunkId => {
                hotDownloadUpdateChunk(chunkId)
            })
        })
}

function hotDownloadUpdateChunk(chunkId) {
    // 通过jsonp请求webpackHotUpdate函数并拿到对应要改变的moreModules
    const script = document.createElement('script')
    script.charset = 'utf-8'
    script.src = '/' + chunkId + "." + hotCurrentHash + '.hot-update.js'
    document.head.appendChild(script)
}

//此方法用来咨询服务器到底相对上一次编译改变了哪些chunk和module
function hotDownLoadManifest() {
    return new Promise((resolve) => {
        const request = new XMLHttpRequest();
        // 上传最新保留的hash
        const requestPath = '/' + hotCurrentHash + ".hot-update.json"
        request.open('GET', requestPath, true)
        request.onreadystatechange = () => {
            if (request.readyState === 4) {
                const update = JSON.parse(request.responseText)
                // 拿到这一次要更新的chunk
                resolve(update)
            }
        }
        request.send()
    })
}

function reloadApp(hot) {
    if (hot) {
        hotEmitter.emit('webpackHotUpdate', currentHash)
    } else {
        window.location.reload()
    }
}

window.hotCreateModule = () => {
    const hot = {
        _acceptedDependencies: {},
        accept: (deps, callback) => {
            for (let i = 0; i < deps.length; i++) {
                hot._acceptedDependencies[deps[i]] = callback
            }
        }
    }
    return hot
}

// 新旧的模块替换
window.webpackHotUpdate = function (chunkId, moreModules) {
    for (let moduleId in moreModules) {
        // 拿到要替换的旧模块
        const oldModule = __webpack_require__.c[moduleId]

        const { parents, children } = oldModule
        // 替换掉旧模块
        const module = __webpack_require__.c[moduleId] = {
            i: moduleId,
            l: false,
            exports: {},
            parents,
            children,
            hot: window.hotCreateModule(moduleId)//module.hot.accept相关
        }
        // 加载新模块
        moreModules[moduleId].call(module.exports, module, module.exports, __webpack_require__)
        module.l = true
        parents.forEach(parent => {
            const parentModule = __webpack_require__.c[parent]
            //重新执行父模块的代码达到代码更新
            parentModule && parentModule.hot && parentModule.hot._acceptedDependencies[moduleId] && parentModule.hot._acceptedDependencies[moduleId]()
        })
        hotCurrentHash = currentHash
    }
}

socket.on('connect', onConnected)