#include "AZ3166WiFi.h"
#include "IoT_DevKit_HW.h"
#include "certs/certs.h"
#include "src/{PATHNAME}/pnp_device.h"

static bool iotHubConnected = false;

void setup()
{
    char buff[128];

    // Initialize the board
    int ret = initIoTDevKit(1);
    if (ret != 0)
    {
        Screen.print(1, "Failed to \r\ninitialize the\r\nIoT DevKit.");
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
        Screen.print(1, "Connect failed\r\nCheck log for \r\n  more info");
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

void __sys_setup(void)
{
    SystemWebAddSettings(&az_iot_default_settings);
}