#include "AZ3166WiFi.h"
#include "DevKitMQTTClient.h"

static bool hasWifi = false;
static bool hasIoTHub = false;

void setup() {
  // put your setup code here, to run once:
  if(WiFi.begin() == WL_CONNECTED)
  {
    hasWifi = true;
    Screen.print(1, "Running... \r\n");

    if (!DevKitMQTTClient_Init())
    {
      hasIoTHub = false;
      return;
    }
    hasIoTHub = true;
  }
  else
  {
    hasWifi = false;
    Screen.print(1, "No Wi-Fi\r\n ");
  }
}

void loop() {
  // put your main code here, to run repeatedly:
  if(hasIoTHub && hasWifi)
  {
    char buff[128];

    // Replace the following line with the data sent to Azure IoTHub
    snprintf(buff, 128, "{\"topic\":\"iot\"}");
    
    if(DevKitMQTTClient_SendEvent(buff))
    {
      Screen.print(1, "Sending... \r\n");
    }
    else
    {
      Screen.print(1, "Failure... \r\n");
    }
    delay(2000);
  }
}
