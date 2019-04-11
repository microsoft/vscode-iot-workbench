//
// Core header files for C and IoTHub layer
//
#include <stdio.h>
#include "IoT_DevKit_HW.h"
#include "AZ3166WiFi.h"
#include "azureiotcerts.h"
#include "azure_c_shared_utility/threadapi.h"
#include "azure_c_shared_utility/xlogging.h"
#include "src/{PATHNAME}/application.h"


// IoT Central requires DPS.  Include required header and constants
#include "azure_prov_client/iothub_security_factory.h"
#include "azure_prov_client/prov_device_ll_client.h"
#include "azure_prov_client/prov_transport_mqtt_client.h"
#include "azure_prov_client/prov_security_factory.h"

static bool networkConnected;
static bool pnpInitialized;

// State of DPS registration process.  We cannot proceed with DPS until we get into the state APP_DPS_REGISTRATION_SUCCEEDED.
typedef enum APP_DPS_REGISTRATION_STATUS_TAG
{
    APP_DPS_REGISTRATION_PENDING,
    APP_DPS_REGISTRATION_SUCCEEDED,
    APP_DPS_REGISTRATION_FAILED
} APP_DPS_REGISTRATION_STATUS;


const SECURE_DEVICE_TYPE secureDeviceTypeForProvisioning = SECURE_DEVICE_TYPE_SYMMETRIC_KEY;
const IOTHUB_SECURITY_TYPE secureDeviceTypeForIotHub = IOTHUB_SECURITY_TYPE_SYMMETRIC_KEY;

// Note: You cannot use an arbitrary DPS instance with the PnP IoT Central example.
static const char* globalDpsEndpoint = "global.azure-devices-provisioning.net";

// TODO: Specify DPS scope ID if you intend on using IoT Central. 
static const char* dpsIdScope = "[DPS Id Scope]";

// TODO: Specify synmmetric keys if you intend on using IoT Central and symmetric key based auth.
static const char* sasKey = "[DPS symmetric key]";

// TODO: specify your device registration ID
static const char* registrationId = "[registration Id]";

// TODO: Fill in PNP_DEVICE_CAPABILITY_MODEL_URI and PNP_MODEL_REPOSITORY_URI if you indend on using IoT Central.
#define PNP_DEVICE_CAPABILITY_MODEL_URI "[your capabilityModel Id]"
#define PNP_MODEL_REPOSITORY_URI "[your model repository service URI]"

static const char* pnpSample_CustomProvisioningData = "{"
                                                            "\"__iot:interfaces\":"
                                                            "{"
                                                            "\"CapabilityModelUri\": \"" PNP_DEVICE_CAPABILITY_MODEL_URI "\" ,"
                                                            "\"ModelRepositoryUri\": \"" PNP_MODEL_REPOSITORY_URI "\""
                                                            "}"
                                                      "}";

// Amount to sleep between querying state from DPS registration loop
static const int dpsRegistrationPollSleep = 1000;

// Maximum amount of times we'll poll for DPS registration being ready.
static const int dpsRegistrationMaxPolls = 60;

// State of PnP registration process.  We cannot proceed with PnP until we get into the state APP_PNP_REGISTRATION_SUCCEEDED.
typedef enum APP_PNP_REGISTRATION_STATUS_TAG
{
    APP_PNP_REGISTRATION_PENDING,
    APP_PNP_REGISTRATION_SUCCEEDED,
    APP_PNP_REGISTRATION_FAILED
} APP_PNP_REGISTRATION_STATUS;

#define IOT_HUB_CONN_STR_MAX_LEN 1024

static char* dpsIotHubUri;
static char* dpsDeviceId;

static void provisioningRegisterCallback(PROV_DEVICE_RESULT register_result, const char* iothub_uri, const char* device_id, void* user_context)
{
    APP_DPS_REGISTRATION_STATUS* appDpsRegistrationStatus = (APP_DPS_REGISTRATION_STATUS*)user_context;

    if (register_result != PROV_DEVICE_RESULT_OK)
    {
        LogError("DPS Provisioning callback called with error state %d", register_result);
        *appDpsRegistrationStatus = APP_DPS_REGISTRATION_FAILED;
    }
    else
    {
        if ((mallocAndStrcpy_s(&dpsIotHubUri, iothub_uri) != 0) ||
            (mallocAndStrcpy_s(&dpsDeviceId, device_id) != 0))
        {
            LogError("Unable to copy provisioning information");
            *appDpsRegistrationStatus = APP_DPS_REGISTRATION_FAILED;
        }
        else
        {
            LogInfo("Provisioning callback indicates success.  iothubUri=%s, deviceId=%s", dpsIotHubUri, dpsDeviceId);
            *appDpsRegistrationStatus = APP_DPS_REGISTRATION_SUCCEEDED;
        }
    }
}

static bool initializeIotHubViaProvisioning(bool traceOn)
{
    PROV_DEVICE_RESULT provDeviceResult;
    PROV_DEVICE_LL_HANDLE provDeviceLLHandle = NULL;

    APP_DPS_REGISTRATION_STATUS appDpsRegistrationStatus = APP_DPS_REGISTRATION_PENDING;

    if (IoTHub_Init() != 0)
    {
        LogError("IoTHub_Init failed");
        return false;
    }

    if (prov_dev_set_symmetric_key_info(registrationId, sasKey) != 0)
    {
        LogError("prov_dev_set_symmetric_key_info failed.");
        return false;
    }

    if (prov_dev_security_init(secureDeviceTypeForProvisioning) != 0)
    {
        LogError("prov_dev_security_init failed");
        return false;
    }

    if ((provDeviceLLHandle = Prov_Device_LL_Create(globalDpsEndpoint, dpsIdScope, Prov_Device_MQTT_Protocol)) == NULL)
    {
        LogError("failed calling Prov_Device_Create");
        return false;
    }

    if ((provDeviceResult = Prov_Device_LL_SetOption(provDeviceLLHandle, PROV_OPTION_LOG_TRACE, &traceOn)) != PROV_DEVICE_RESULT_OK)
    {
        LogError("Setting provisioning tracing on failed, error=%d", provDeviceResult);
        return false;
    }

    if ((provDeviceResult = Prov_Device_LL_SetOption(provDeviceLLHandle, "TrustedCerts", certificates)) != PROV_DEVICE_RESULT_OK)
    {
        LogError("Setting provisioning TrustedCerts failed, error=%d", provDeviceResult);
        return false;
    }

    if ((provDeviceResult = Prov_Device_LL_SetProvisioningData(provDeviceLLHandle, pnpSample_CustomProvisioningData)) != PROV_DEVICE_RESULT_OK)
    {
        LogError("Failed setting provisioning data, error=%d", provDeviceResult);
        return false;
    }

    if ((provDeviceResult = Prov_Device_LL_Register_Device(provDeviceLLHandle, provisioningRegisterCallback, &appDpsRegistrationStatus, NULL, NULL)) != PROV_DEVICE_RESULT_OK)
    {
        LogError("Prov_Device_Register_Device failed, error=%d", provDeviceResult);
        return false;
    }
    else
    {
        for (int i = 0; (i < dpsRegistrationMaxPolls) && (appDpsRegistrationStatus == APP_DPS_REGISTRATION_PENDING); i++)
        {
            ThreadAPI_Sleep(dpsRegistrationPollSleep);
            Prov_Device_LL_DoWork(provDeviceLLHandle);
        }

        if (appDpsRegistrationStatus == APP_DPS_REGISTRATION_SUCCEEDED)
        {
            LogInfo("DPS successfully registered.  Continuing on to creation of IoTHub device client handle.");
        }
        else if (appDpsRegistrationStatus == APP_PNP_REGISTRATION_PENDING)
        {
            LogError("Timed out attempting to register DPS device");
            return false;
        }
        else
        {
            LogError("Error registering device for DPS");
            return false;
        }
    }

    if (appDpsRegistrationStatus == APP_DPS_REGISTRATION_SUCCEEDED)
    {
        char connectionString[IOT_HUB_CONN_STR_MAX_LEN] = { 0 };

        if (secureDeviceTypeForProvisioning == SECURE_DEVICE_TYPE_SYMMETRIC_KEY)
        {
            snprintf(connectionString, IOT_HUB_CONN_STR_MAX_LEN,
                "HostName=%s;DeviceId=%s;SharedAccessKey=%s",
                dpsIotHubUri,
                dpsDeviceId,
                sasKey);
        }
        else if (secureDeviceTypeForProvisioning == SECURE_DEVICE_TYPE_X509)
        {
            snprintf(connectionString, IOT_HUB_CONN_STR_MAX_LEN,
                "HostName=%s;DeviceId=%s;UseProvisioning=true",
                dpsIotHubUri,
                dpsDeviceId);
        }

        LogInfo("IoT Hub Connection String: %s", connectionString);
        application_initialize(connectionString, certificates);
    }
    else
    {
        LogError("Device Provisioning: device registration step has failed.");
        return false;
    }

    if (provDeviceLLHandle != NULL)
    {
        Prov_Device_LL_Destroy(provDeviceLLHandle);
    }

    return true;
}

void setup() {
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
    //application_initialize(getIoTHubConnectionString(), certificates);
    pnpInitialized = initializeIotHubViaProvisioning(false);
    digitalWrite(LED_AZURE, 1);
    snprintf(buff, sizeof(buff), "%s\r\nPnP enabled\r\nRunning...\r\n", getDevKitName());
    Screen.print(1, buff);
}

void loop() {
    // put your main code here, to run repeatedly:
    if (networkConnected && pnpInitialized)
    {
        application_run();
    }

    invokeDevKitPeripheral();
    delay(500);
}