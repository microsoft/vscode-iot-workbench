#include "IoT_DevKit_HW.h"
#include "DevKitMQTTClient.h"

static bool hasWifi = false;
static bool hasIoTHub = false;
static int msgCount = 0;
static int errCount = 0;

void setup() {
  // init the board
  int init = initIoTDevKit(1);
  if (init == 0)
  {
    hasWifi = true;
    Screen.clean();
    Screen.print(0, "IoT DevKit");
    Screen.print(1, "Connecting...");

    if (!DevKitMQTTClient_Init())
    {
      Screen.print(1, "No IoT Hub");
      return;
    }
    Screen.print(1, "Running...");
    hasIoTHub = true;
  }
  else
  {
    char buff[32];
    snprintf(buff, sizeof(buff), "Init failed (%d)", init);
    Screen.print(buff);
  }
}

void loop() {
  // put your main code here, to run repeatedly:
  if (hasIoTHub && hasWifi)
  {
    char buff[64];

    // replace the following line with your data sent to Azure IoTHub
    snprintf(buff, sizeof(buff), "{\"topic\":\"iot\"}");

    if (!DevKitMQTTClient_SendEvent(buff))
    {
      errCount++;
    }
    msgCount++;

    snprintf(buff, sizeof(buff), " Sent:%d\r\n Failed:%d", msgCount - errCount, errCount);
    Screen.print(2, buff);
    delay(2000);
  }
}
