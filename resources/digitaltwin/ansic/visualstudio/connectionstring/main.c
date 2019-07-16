#ifdef WIN32
#include <windows.h>
#elif _POSIX_C_SOURCE >= 199309L
#include <time.h> // for nanosleep
#else
#include <unistd.h> // for usleep
#endif

#include "pnp_device.h"

void sleep_ms(int milliseconds) // cross-platform sleep function
{
#ifdef WIN32
    Sleep(milliseconds);
#elif _POSIX_C_SOURCE >= 199309L
    struct timespec ts;
    ts.tv_sec = milliseconds / 1000;
    ts.tv_nsec = (milliseconds % 1000) * 1000000;
    nanosleep(&ts, NULL);
#else
    usleep(milliseconds * 1000);
#endif
}

int main(int argc, char *argv[])
{
    if (argc != 2)
    {
        LogError("USAGE: {PROJECT_NAME} [IoTHub device connection string]");
        return 1;
    }

    if (pnp_device_initialize(argv[1], NULL) != 0)
    {
        LogError("Failed to initialize the application.");
        return 1;
    }

    while (1)
    {
        pnp_device_run();
        sleep_ms(100);
    }
    return 0;
}