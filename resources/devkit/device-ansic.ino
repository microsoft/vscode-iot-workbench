#include "src/{PATHNAME}/application.h"
#include "IoT_DevKit_HW.h"
#include "AZ3166WiFi.h"
#include "azureiotcerts.h"

static bool networkConnected;

void init_network()
{
     Screen.print(2, "Connecting...");

    if (WiFi.begin() == WL_CONNECTED)
    {
        IPAddress ip = WiFi.localIP();
        Screen.print(1, ip.get_address());
        networkConnected = true;
        Screen.print(2, "Wi-Fi connected\r\n");
    }
    else
    {
        networkConnected = false;
        Screen.print(1, "No Wi-Fi\r\n ");
    }
}

void setup() {
    char buff[128];

    // Initialize the board
    networkConnected = initIoTDevKit();
    
    if (!networkConnected)
    {
        Screen.print(1, "No WiFi");
        return;
    }
    else
    {
        IPAddress ip = WiFi.localIP();
        snprintf(buff, sizeof(buff), "%s\r\nWiFi Connected\r\n%s", WiFi.SSID(), ip.get_address());
        Screen.print(1, buff);
    }

    // Initialize device model application
    application_initialize(getIoTHubConnectionString(), certificates);
    digitalWrite(LED_AZURE, 1);
    snprintf(buff, sizeof(buff), "%s\r\nPnP enabled\r\nRunning...\r\n", getDevKitName());
    Screen.print(1, buff);
}

void loop() {
    // put your main code here, to run repeatedly:
    if (networkConnected)
    {
        application_run();
    }

    invokeDevKitSensors();
    delay(500);
}
