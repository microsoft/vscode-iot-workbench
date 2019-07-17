//
// Core header files for C and IoTHub layer
//
#include <stdio.h>
#include "azure_c_shared_utility/threadapi.h"
#include "azure_c_shared_utility/xlogging.h"
#include "pnp_device.h"

int main(int argc, char *argv[])
{
    if (argc != 2)
    {
        LogError("USAGE: {PROJECT_NAME} [IoTHub device connection string]");
        return 1;
    }

    if(pnp_device_initialize(argv[1], NULL) != 0)
    {
        LogError("Failed to initialize the application.");
        return 1;
    }

    while (1)
    {
        pnp_device_run();
        ThreadAPI_Sleep(100);
    }
    return 0;
}