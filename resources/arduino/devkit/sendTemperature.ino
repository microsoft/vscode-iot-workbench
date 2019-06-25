#include "AZ3166WiFi.h"
#include "AzureIotHub.h"
#include "DevKitMQTTClient.h"
#include "OledDisplay.h"
#include "HTS221Sensor.h"

// Indicate whether WiFi is ready
static bool hasWifi = false;

// Indicate whether IoT Hub is ready
static bool hasIoTHub = false;

DevI2C *i2c;
HTS221Sensor *sensor;

void SensorInit()
{
    i2c = new DevI2C(D14, D15);
    sensor = new HTS221Sensor(*i2c);
    sensor->init(NULL);
}

float readTemperature()
{
    sensor->reset();
    float temperature = 0;
    sensor->getTemperature(&temperature);
    return temperature;
}

bool InitWifi()
{
    if (WiFi.begin() == WL_CONNECTED)
    {
        IPAddress ip = WiFi.localIP();
        return true;
    }
    else
    {
        return false;
    }
}

void setup() {
  Screen.init();
  Screen.print(2, "Initializing...");
  Screen.print(3, " > WiFi");
  hasWifi = InitWifi();
  if (!hasWifi)
  {
    Screen.clean();
    Screen.print(2, "No connection.");
    return;
  }
  Screen.print(3, " > Sensor");
  SensorInit();
  Screen.print(3, " > IoT Hub");
  hasIoTHub = DevKitMQTTClient_Init();
  if (!hasIoTHub)
  {
    Screen.clean();
    Screen.print(2, "No IoT Hub.");
    return;
  }
}

void loop() {
  if (hasWifi && hasIoTHub) {
    float temperature = readTemperature();
    char buff[32];
    char screenBuff[10];
    snprintf(buff, 32, "{\"temperature\": %.1f}", temperature);
    snprintf(screenBuff, 10, "%.1f\r\n", temperature);
    Screen.print(2, "Temperature:\r\n");
    Screen.print(3, screenBuff);
    DevKitMQTTClient_SendEvent(buff);
    delay(5);
  }
}
