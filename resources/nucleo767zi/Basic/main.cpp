#include "mbed.h"

Serial pc(USBTX, USBRX, 115200);
DigitalOut led3(LED3);

int main(void)
{
    while (true)
    {
            led3 = !led3;
            wait(1);
    }
    return 0;
}

