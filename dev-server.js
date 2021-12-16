const path = require('path')
const express = require('express')
const mime = require('mime')

// 操作内存文件
const MemoryFileSystem = require('memory-fs')
const webpack = require('webpack')

const config = require('./webpack.config')
const compiler = webpack(config)


class Server {
    constructor(compiler) {
        this.compiler = compiler
        let sockets = []
        // 每次编译完成后都会产生一个stats对象
        // 其中一个hash值代表了这次编译的结果hash
        let lasthash
        compiler.hooks.done.tap('webpack-dev-server', (stats) => {
            console.log('stats.hash', stats.hash);
            lasthash = stats.hash
            //每当一个新的编译完成后都会向客户端发送消息
            sockets.forEach(socket => {
                // 先向客户端发送最新的hash值
                // 每次编译都会产生一个哈希值，另外如果是热更新，还会产生两个热补丁文件
                //里面描述了从上一次结果到这一次结果都有哪些chunk和module发生变化
                socket.emit('hash', stats.hash)
                //再向客户端发送一个ok
                socket.emit('ok')
            })
        })
        const app = new express()
        compiler.watch({}, err => {
            console.log('又一次启动编译成功');
        })
        //MemoryFileSystem处理文件内存
        const fs = new MemoryFileSystem()
        compiler.outputFileSystem = fs
        function middleware(req, res, next) {
            const filename = path.join(config.output.path, req.url.slice(1));
            const stat = fs.statSync(filename);
            //判断这个文件是否存在
            if (stat.isFile()) {
                //读取内存中打包代码 速度比读取磁盘的打包代码还要快
                const content = fs.readFileSync(filename)
                const contentType = mime.getType(filename)
                res.setHeader('Content-Type', contentType)
                res.statusCode = res.statusCode || 200
                res.send(content)
            } else {
                return res.sendStatus(404)
            }
        }
        app.use(middleware)

        this.server = require('http').createServer(app)

        let io = require('socket.io')(this.server)
        io.on('connection', (socket) => {
            sockets.push(socket)
            socket.emit('hash', lasthash)
            socket.emit('ok')
        })
    }

    listen(port) {
        this.server.listen(port, () => {
            console.log(`服务已在${port}启动`);
        })
    }
}

let server = new Server(compiler)

server.listen(8000)