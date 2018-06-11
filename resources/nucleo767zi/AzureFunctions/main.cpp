#include "mbed.h"
#include "iothub_client_sample_mqtt.h"

Serial pc(USBTX, USBRX, 115200);
DigitalOut led3(LED3);
NetworkInterface* network;

int main(void)
{
    iothub_client_sample_mqtt_run();


    while (true)
    {
            led3 = !led3;
            wait(1);
    }

    return 0;
}

