
const express = require('express')
const app = express()
const path = require('path')
app.use(express.static(path.join(__dirname, 'public')))

const httpServer = require('http').createServer(app)
const io = require('socket.io')(httpServer, {})

const SerialPort = require('serialport')
const port = new SerialPort('/dev/tty.wchusbserial1420', { baudRate: 115200 }) // serialport config

const { promisify } = require('util')
const fs = require('fs')
const fsPromise = {
  writeFile: promisify(fs.writeFile),
  readFile: promisify(fs.readFile)
}

function saferesolve(base, target) {
  var targetPath = '.' + path.posix.normalize('/' + target)
  return path.posix.resolve(base, targetPath)
  // https://stackoverflow.com/questions/37862886/safe-path-resolve-without-escaping-from-parent
}

// // Open errors will be emitted as an error event
// port.on('error', function(err) {
//   console.log('Error: ', err.message)
// })

let currentSocket;
io.on('connection', socket => {
  // either with send()
  // socket.send('Qifei Master Proxy')

  // // or with emit() and custom event names
  // socket.emit('greetings', 'Hey!', { 'ms': 'jane' }, Buffer.from([4, 3, 3, 1]))

  currentSocket = socket;

  // handle the event sent with socket.send()
  socket.on('message', (data) => {
    console.log("w")
    console.dir(data)
    port.write(data, function (err) {
      if (err) {
        return console.log('Error on write: ', err.message)
      }
      // console.log('message written')
    })
  })

  // handle the event sent with socket.emit()
  socket.on('save', async (name, data) => {
    console.log('s ' + name)
    await fsPromise.writeFile(saferesolve('data/', name), data)
    socket.emit('save_ack')
  })

  socket.on('load', async (name) => {
    console.log('l ' + name)
    let data = (await fsPromise.readFile(saferesolve('data/', name))).toString()
    socket.emit('load_ack', data)
  })
})

port.on('data', function (data) {
  if (data === null) return;
  data = data === null ? '' : data.toString()
  console.log("r")
  console.dir(data)
  if (currentSocket) currentSocket.send(data) // TODO 处理死 socket
})

httpServer.listen(3000)
// WARNING !!! app.listen(3000); will not work here, as it creates a new HTTP server

// ref: https://stackoverflow.com/questions/24852222/serve-static-files-with-node-js-socket-io/24852307
// ref: https://socket.io/docs/v4/server-initialization/