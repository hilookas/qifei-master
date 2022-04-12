'use strict';

// 通信
// eg: runCommand('egp').then((data) => { console.log(data) });
// eg: await save('pic.txt', data);
// eg: data = await load('pic.txt');
(async () => {
  const socket = io();

  let consoleIdle = false; // 端口控速
  socket.on('connect', () => { socket.send('\n'); consoleIdle = true; });

  let capturing = false; // 捕获输出
  let captureBuf;
  let captureCb;
  let captureTimeout;
  socket.on('message', data => {
    let $output = document.querySelector('#console-output');
    $output.value += data;
    $output.value = $output.value.slice(-1024);
    $output.scrollTop = $output.scrollHeight;
    if (capturing) {
      captureBuf += data;
      if (captureBuf.slice(-5) === 'msh >') {
        clearTimeout(captureTimeout);
        capturing = false;
        consoleIdle = true;
        captureCb(captureBuf.slice(0, captureBuf.length - 5));
      }
    }
  });
  window.runCommand = async (command, timeout) => {
    if (!consoleIdle) throw new Error('working');
    consoleIdle = false;
    
    return (await new Promise((resolve, reject) => {
      capturing = true;
      captureBuf = '';
      captureCb = resolve;
      captureTimeout = setTimeout(() => {
        capturing = false;
        consoleIdle = true;
        reject(new Error('timeout'));
      }, timeout ? timeout : 10000); // 解决偶尔丢包导致的无响应问题

      socket.send(command + '\n');
    })).slice(command.length + 2); // 去除命令输入回显带来的干扰，其中 +2 是为了去掉最后的 \r\n
  }

  let $input = document.querySelector('#console-input');
  $input.addEventListener('keyup', e => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      runCommand($input.value);
      $input.value = '';
    }
  });

  let saveIdle = true;
  let saveCb;
  let saveTimeout;
  socket.on('save_ack', () => {
    clearTimeout(saveTimeout);
    saveIdle = true;
    saveCb();
  });
  window.save = async (name, data) => {
    if (!saveIdle) throw new Error('working');
    saveIdle = false;

    await new Promise((resolve, reject) => {
      saveCb = resolve;
      saveTimeout = setTimeout(() => {
        saveIdle = true;
        reject(new Error('timeout'));
      }, 10000);

      socket.emit('save', name, data);
    });
  }

  let loadIdle = true;
  let loadCb;
  let loadTimeout;
  socket.on('load_ack', (data) => {
    clearTimeout(loadTimeout);
    loadIdle = true;
    loadCb(data);
  });
  window.load = async (name) => {
    if (!loadIdle) throw new Error('working');
    loadIdle = false;

    return await new Promise((resolve, reject) => {
      loadCb = resolve;
      loadTimeout = setTimeout(() => {
        loadIdle = true;
        reject(new Error('timeout'));
      }, 10000);

      socket.emit('load', name);
    });
  }
})();

(() => {
  window.curv = 0;
  window.speed = 0;

  window.maxCurv = 20;
  window.maxSpeed = 100;
  let $maxCurv = document.querySelector('#max-curv');
  let $maxSpeed = document.querySelector('#max-speed');
  $maxCurv.value = maxCurv;
  $maxSpeed.value = maxSpeed;
  $maxCurv.addEventListener('change', e => {
    maxCurv = $maxCurv.value;
  });
  $maxSpeed.addEventListener('change', e => {
    maxSpeed = $maxSpeed.value;
  });

  // (async () => {
  //   await new Promise((resolve, reject) => {
  //     setTimeout(resolve, 500);
  //   });
  //   await runCommand('sri');
  //   await runCommand('egi');
  // })();

  window.changeCurv = (newCurv) => {
    if (newCurv > maxCurv) newCurv = maxCurv;
    if (newCurv < -maxCurv) newCurv = -maxCurv;
    if (curv !== newCurv) {
      curv = newCurv;
      // console.dir(curv);
      (async () => {
        for (let i = 0; i < 3; ++i) { // 三次重试
          try {
            await runCommand('srs ' + curv, 1000);
            return;
          } catch (err) {}
          await new Promise((resolve, reject) => {
            setTimeout(resolve, 100);
          });
        }
      })();
    }
  }

  window.changeSpeed = (newSpeed) => {
    if (newSpeed > maxSpeed) newSpeed = maxSpeed;
    if (newSpeed < -maxSpeed) newSpeed = -maxSpeed;
    if (speed !== newSpeed) {
      speed = newSpeed;
      // console.dir(speed);
      (async () => {
        for (let i = 0; i < 3; ++i) { // 三次重试
          try {
            await runCommand('egs ' + speed, 1000);
            return;
          } catch (err) {}
          await new Promise((resolve, reject) => {
            setTimeout(resolve, 100);
          });
        }
      })();
    }
  }
})();

// key
(() => {
  let curvLock = false;
  let speedLock = false;
  function turnLeft()     { if (curvLock) return; curvLock = true; changeCurv(-maxCurv); }
  function turnRight()    { if (curvLock) return; curvLock = true; changeCurv(maxCurv); }
  function turnStraight() { curvLock = false; changeCurv(0); }
  function speedForward() { if (speedLock) return; speedLock = true; changeSpeed(maxSpeed); }
  function speedBack()    { if (speedLock) return; speedLock = true; changeSpeed(-maxSpeed); }
  function speedIdle()    { speedLock = false; changeSpeed(0); }
  
  document.querySelector('#control-button-left') .addEventListener('mousedown', turnLeft);
  document.querySelector('#control-button-left') .addEventListener('mouseup',   turnStraight);
  document.querySelector('#control-button-right').addEventListener('mousedown', turnRight);
  document.querySelector('#control-button-right').addEventListener('mouseup',   turnStraight);
  document.querySelector('#control-button-up')  .addEventListener('mousedown', speedForward);
  document.querySelector('#control-button-up')  .addEventListener('mouseup',   speedIdle);
  document.querySelector('#control-button-down').addEventListener('mousedown', speedBack);
  document.querySelector('#control-button-down').addEventListener('mouseup',   speedIdle);
  
  function keyDownHandler(event) {
    const keyName = event.key;
  
    if (keyName === 'Control') {
      return;
    }
  
    switch (keyName) {
    case 'ArrowLeft':
    case 'a':
      turnLeft();
      break;
    case 'ArrowRight':
    case 'd':
      turnRight();
      break;
    case 'ArrowUp':
    case 'w':
      speedForward();
      break;
    case 'ArrowDown':
    case 's':
      speedBack();
      break;
    }
  }
  
  function keyUpHandler(event) {
    const keyName = event.key;
  
    if (keyName === 'Control') {
      return;
    }
  
    switch (keyName) {
    case 'ArrowLeft':
    case 'a':
    case 'ArrowRight':
    case 'd':
      turnStraight();
      break;
    case 'ArrowUp':
    case 'w':
    case 'ArrowDown':
    case 's':
      speedIdle();
      break;
    }
  }

  let keyHandlerInited = false;
  function keyHandlerInit() {
    if (keyHandlerInited) return;
    keyHandlerInited = true;

    document.addEventListener('keydown', keyDownHandler, false);
    document.addEventListener('keyup', keyUpHandler, false);
  }

  function keyHandlerDeinit() {
    if (!keyHandlerInited) return;
    keyHandlerInited = false;

    document.removeEventListener('keydown', keyDownHandler, false);
    document.removeEventListener('keyup', keyUpHandler, false);

    turnStraight();
    speedIdle();
  }

  document.querySelector('.control-button').parentNode.addEventListener('mouseenter', keyHandlerInit);
  document.querySelector('.control-button').parentNode.addEventListener('mouseleave', keyHandlerDeinit);

  // ref: https://developer.mozilla.org/en-US/docs/Web/API/Element/querySelector
  // ref: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
  // ref: https://developer.mozilla.org/zh-CN/docs/Web/API/KeyboardEvent
})();

// Gamepad
(() => {
  var haveEvents = 'ongamepadconnected' in window;
  var controllers = {};

  function connectHandler(e) {
    addGamepad(e.gamepad);
  }

  function addGamepad(gamepad) {
    controllers[gamepad.index] = gamepad;
    document.querySelector('#controller-info').innerHTML = 'Controller Connected';
    setTimeout(updateStatus, 100);
  }

  function disconnectHandler(e) {
    removeGamepad(e.gamepad);
  }

  function removeGamepad(gamepad) {
    delete controllers[gamepad.index];
    document.querySelector('#controller-info').innerHTML = 'Controller Disconnected';
  }

  function updateStatus() {
    if (!haveEvents) {
      scanGamepads();
    }

    var i = 0;
    var j;

    for (j in controllers) {
      var controller = controllers[j];

      let sum = 0;
      for (i = 0; i < controller.buttons.length; i++) {
        var val = controller.buttons[i];
        var pressed = val == 1.0;
        if (typeof(val) == "object") {
          pressed = val.pressed;
          val = val.value;
        }

        var pct = Math.round(val * 100) + "%";

        if (i === 6) { // left 
          sum += val;
        } else if (i === 7) { // right
          sum -= val;
        }
      }
      changeSpeed(Math.round(Math.round(sum * 5) / 5 * maxSpeed)); // 5 段式线性

      for (i = 0; i < controller.axes.length; i++) {
        var val = controller.axes[i];
        // val: -1~1

        if (i === 0) { // h
          changeCurv(Math.round(Math.round(val * 5) / 5 * maxCurv)); // 5 段式线性
        }
      }
    }

    setTimeout(updateStatus, 100);
  }

  function scanGamepads() {
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    for (var i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        if (gamepads[i].index in controllers) {
          controllers[gamepads[i].index] = gamepads[i];
        } else {
          addGamepad(gamepads[i]);
        }
      }
    }
  }

  window.addEventListener("gamepadconnected", connectHandler);
  window.addEventListener("gamepaddisconnected", disconnectHandler);

  if (!haveEvents) {
    setInterval(scanGamepads, 500);
  }
  // from https://developer.mozilla.org/zh-CN/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
})();

(() => {
  let $canvas = document.querySelector('#cam-output'),
      ctx = $canvas.getContext('2d');
  $canvas.height = 120;
  $canvas.width = 188;

  let shownRawRst;
  async function show(rawRst) {
    shownRawRst = rawRst;
    let rst = rawRst.split('\r\n');

    let height = parseInt(rst[0]);
    let width = parseInt(rst[1]);
    let pixelLength = height * width;
    let rawData = new Uint8ClampedArray(pixelLength * 4);
    for (let i = 0; i < pixelLength; ++i) {
      let current = parseInt(rst[2][2 * i] + rst[2][2 * i + 1], 16);
      let baseIndex = i * 4;
      rawData[baseIndex] = current;
      rawData[baseIndex + 1] = current;
      rawData[baseIndex + 2] = current;
      rawData[baseIndex + 3] = 256;
    }
    
    let imageData = new ImageData(rawData, width, height);
    ctx.putImageData(imageData, 0, 0);
    // https://stackoverflow.com/questions/34963963/converting-a-hex-string-of-a-raw-image-to-a-bitmap-image-in-javascript
  }

  async function shot() {
    await show(await runCommand('cmg', 30000));
  }

  let $name = document.querySelector('#cam-name');
  $name.value = 'pic.txt';
  async function save() {
    await window.save($name.value, shownRawRst);
  }

  async function download() {
    $canvas.toBlob((blob) => {
      window.saveAs(blob, $name.value + '.png');
    });
  }

  async function load() {
    await show(await window.load($name.value));
  }

  async function shotNameSaveDownload() {
    let value = parseInt($name.value);
    if (isNaN(value)) value = 0;
    ++value;
    $name.value = value;

    await shot();
    await save();
    await download();
  }

  document.querySelector('#cam-shot').addEventListener('click', shot);
  document.querySelector('#cam-save').addEventListener('click', save);
  document.querySelector('#cam-download').addEventListener('click', download);
  document.querySelector('#cam-load').addEventListener('click', load);
  document.querySelector('#cam-shot-name-save-download').addEventListener('click', shotNameSaveDownload);

  
})();