var NRF24 = require('nrf');
var buffertools = require('buffertools');

var spiDev = '/dev/spidev0.0';
var cePin = 24;
var irqPin = 25;
var localAddress = 0xF0F0F0F0D2;

var radio = NRF24.connect(spiDev, cePin, irqPin);

function generateRandomInteger(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

function generateRandomAddress() {
  var address = new Array(5);

  for (var i = 0; i < address.length; i++) {
    address[i] = generateRandomInteger(128, 255);
  }

  return new Buffer(address);
}

function processSensorData(sensorData, remoteAddress) {
  var distance = (sensorData[0] << 8) | sensorData[1];
  console.log(distance);
}

function replyJoinRequest(remoteAddress) {
  console.log('Opening TX pipe at:', remoteAddress);
  var tx = radio.openPipe('tx', remoteAddress);

  var newRemoteAddress = generateRandomAddress();
  console.log('New remote address:', newRemoteAddress);

  setTimeout(function() {
    var replyPacket = new Buffer(7);
    replyPacket[0] = 0x00; // Interval high byte
    replyPacket[1] = 0x05; // Interval low byte
    newRemoteAddress.copy(replyPacket, 2, 0);
    buffertools.reverse(replyPacket);

    console.log('Replying join request...');

    tx.write(replyPacket, function() {
      tx.close();
    });
  }, 100);
}

function processIncomingData(data) {
  var command = data[0];

  switch (command) {
    case 0x00: // Join request
      var remoteAddress = data.slice(1);
      replyJoinRequest(remoteAddress);
      break;
    case 0x01: // Sensor data
      var sensorData = data.slice(1, 3);
      var remoteAddress = data.slice(3);
      processSensorData(sensorData, remoteAddress);
      break;
  }
}

(function() {
  radio
    .channel(0x4c)
    .transmitPower('PA_MAX')
    .dataRate('1Mbps')
    .crcBytes(2)
    .autoRetransmit({
      count: 15,
      delay: 4000
    })
    .begin(function() {
      console.log('Initializing radio...');

      var rx = radio.openPipe('rx', localAddress);
      //var rx = radio.openPipe('rx', localAddress, { autoAck: true, size: 10 });

      rx.on('ready', function() {
        radio.printDetails();

        rx.on('data', function(data) {
          buffertools.reverse(data);
          console.log('Got data', data);

          processIncomingData(data);
        });
      });
    });
})();
