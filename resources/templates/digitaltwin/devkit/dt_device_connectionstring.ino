#include "src/{PATHNAME}/application.h"
#include "IoT_DevKit_HW.h"
#include "AZ3166WiFi.h"
#include "azureiotcerts.h"

static bool networkConnected;

void setup()
{
    char buff[128];

    // Initialize the board
    int ret = initIoTDevKit(1);
    if (ret != 0)
    {
        networkConnected = false;
        Screen.print(1, "Failed: %d", ret);
        return;
    }
    else
    {
        networkConnected = true;
        IPAddress ip = WiFi.localIP();
        snprintf(buff, sizeof(buff), "%s\r\nWiFi Connected\r\n%s", WiFi.SSID(), ip.get_address());
        Screen.print(1, buff);
    }

    // Initialize device model application
    if (application_initialize(getIoTHubConnectionString(), certificates) != 0)
    {
        return;
    }
    digitalWrite(LED_AZURE, 1);
    snprintf(buff, sizeof(buff), "%s\r\nPnP enabled\r\nRunning...\r\n", getDevKitName());
    Screen.print(1, buff);
}

void loop()
{
    // put your main code here, to run repeatedly:
    if (networkConnected)
    {
        application_run();
    }

    invokeDevKitPeripheral();
    delay(500);
}
