const clientFromConnectionString = require('azure-iot-device-mqtt').clientFromConnectionString;
const Message = require('azure-iot-device').Message;
const connectionString = require('./config.json').connectionString;
const client = clientFromConnectionString(connectionString);

client.open(err => {
  if (err) {
    console.error('Could not connect: ' + err);
    process.exit(1);
  } else {
    const data = {
      topic: 'iot'
    };
    const message = new Message(JSON.stringify(data));

    setInterval(() => {
      client.sendEvent(message, err => {
        if (err) {
          console.warn('Send message to IoT Hub failed: ' + err.toString());
        } else {
          console.log('Message sent to IoT Hub.');
        }
      });
    }, 2000);
    
    client.on('message', msg => { 
      console.log(msg); 
      client.complete(msg, () => {
        console.log('completed');
      });
    }); 
  }
});