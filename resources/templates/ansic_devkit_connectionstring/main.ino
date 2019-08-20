#include "AZ3166WiFi.h"
#include "IoT_DevKit_HW.h"
#include "certs/certs.h"
#include "src/{PATHNAME}/pnp_device.h"

static bool iotHubConnected = false;

void setup()
{
    char buff[64];

    // Initialize the board
    int ret = initIoTDevKit(1);
    if (ret != 0)
    {
        if (ret == -100)
        {
            Screen.print(1, "No Wi-Fi.\r\n \r\n ");
        }
        else
        {
            Screen.print(1, "Internal error!\r\nCheck log for\r\n more detail.");
        }
        return;
    }
    else
    {
        IPAddress ip = WiFi.localIP();
        snprintf(buff, sizeof(buff), "%s\r\nWiFi Connected\r\n%s", WiFi.SSID(), ip.get_address());
        Screen.print(1, buff);
    }

    // Initialize device model application
    if (pnp_device_initialize(getIoTHubConnectionString(), certificates) != 0)
    {
        digitalWrite(LED_AZURE, 0);
        Screen.print(1, "Error: \r\nIoT Hub is not\r\navailable.");
        iotHubConnected = false;
    }
    else
    {
        digitalWrite(LED_AZURE, 1);
        Screen.print(1, "PnP enabled\r\nRunning...");
        iotHubConnected = true;
    }
}

void loop()
{
    // put your main code here, to run repeatedly:
    if (iotHubConnected)
    {
        pnp_device_run();
    }

    invokeDevKitPeripheral();
    delay(500);
}
