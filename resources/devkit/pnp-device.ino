#include "src/{PATHNAME}/application.h"
#include "EEPROMInterface.h"
#include "AZ3166WiFi.h"

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
    // Initialize Wi-Fi
    init_network();

    // Read connection string
    char connString[AZ_IOT_HUB_MAX_LEN + 1] = {'\0'};
    EEPROMInterface eeprom;
    eeprom.read((uint8_t *)connString, AZ_IOT_HUB_MAX_LEN, 0, AZ_IOT_HUB_ZONE_IDX);

    // Initialize device model application
    application_initialize(connString);
}

void loop() {
    // put your main code here, to run repeatedly:
    Screen.print("loop");

    if (networkConnected)
    {
        application_run();
    }

    delay(3000);
}

