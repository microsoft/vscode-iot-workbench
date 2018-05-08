#include "AZ3166WiFi.h"
#include "DevKitMQTTClient.h"
#include "http_client.h"

static bool hasWifi = false;
static bool hasIoTHub = false;

void setup() {
  // put your setup code here, to run once:
  if (WiFi.begin() == WL_CONNECTED)
  {
    hasWifi = true;
    Screen.print(1, "Running...");

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
    Screen.print(1, "No Wi-Fi");
  }

  HTTPClient client(HTTP_GET, "http://www.pacdv.com/sounds/people_sound_effects/yes_1.wav");
  const Http_Response* response = client.send();
}

void loop() {

}
