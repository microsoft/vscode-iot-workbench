//
// Core header files for C and IoTHub layer
//
#include <stdio.h>
#include "AZ3166WiFi.h"
#include "IoT_DevKit_HW.h"
#include "azure_c_shared_utility/connection_string_parser.h"
#include "azure_c_shared_utility/string_tokenizer.h"
#include "azure_c_shared_utility/threadapi.h"
#include "azure_c_shared_utility/xlogging.h"
#include "certs/certs.h"
#include "src/{PATHNAME}/pnp_device.h"

// IoT Central requires DPS.  Include required header and constants
#include "azure_prov_client/iothub_security_factory.h"
#include "azure_prov_client/prov_device_ll_client.h"
#include "azure_prov_client/prov_transport_mqtt_client.h"
#include "azure_prov_client/prov_security_factory.h"

static bool iotHubConnected = false;

// State of DPS registration process.  We cannot proceed with DPS until we get into the state APP_DPS_REGISTRATION_SUCCEEDED.
typedef enum APP_DPS_REGISTRATION_STATUS_TAG
{
    APP_DPS_REGISTRATION_PENDING,
    APP_DPS_REGISTRATION_SUCCEEDED,
    APP_DPS_REGISTRATION_FAILED
} APP_DPS_REGISTRATION_STATUS;

const SECURE_DEVICE_TYPE secureDeviceTypeForProvisioning = SECURE_DEVICE_TYPE_SYMMETRIC_KEY;
const IOTHUB_SECURITY_TYPE secureDeviceTypeForIotHub = IOTHUB_SECURITY_TYPE_SYMMETRIC_KEY;

// DPSEndpoint=[DPS global endpoint];ScopeId=[Scope ID];RegistrationId=[Registration ID];SymmetricKey=[symmetric key]
static const char *IOTHUBDPS_ENDPOINT = "DPSEndpoint";
static const char *IOTHUBDPS_SCOPEID = "ScopeId";
static const char *IOTHUBDPS_REGISTRATIONID = "RegistrationId";
static const char *IOTHUBDPS_SYMMETRICKEY = "SymmetricKey";

// The Device Provisioning Service (DPS) endpoint, learn more from https://docs.microsoft.com/en-us/azure/iot-dps/tutorial-set-up-device#create-the-device-registration-software.
static char *globalDpsEndpoint = NULL;
// The Device Provisioning Service (DPS) ID Scope.
static char *dpsIdScope = NULL;
// The symmetric key, learn more from https://docs.microsoft.com/en-us/azure/iot-dps/concepts-symmetric-key-attestation.
static char *sasKey = NULL;
// The device ID, learn more from https://docs.microsoft.com/en-us/azure/iot-dps/use-hsm-with-sdk.
static char *deviceId = NULL;

// TODO: Fill in DIGITALTWIN_DEVICE_CAPABILITY_MODEL_INLINE_DATA if want to make deivce self-describing.
#define DIGITALTWIN_DEVICE_CAPABILITY_MODEL_INLINE_DATA "{}"

static const char *digitalTwinSample_CustomProvisioningData = "{"
                                                              "\"__iot:interfaces\":"
                                                              "{"
                                                              "\"CapabilityModelId\": \"{DCM_ID}\" ,"
                                                              "\"CapabilityModel\": \"" DIGITALTWIN_DEVICE_CAPABILITY_MODEL_INLINE_DATA "\""
                                                              "}"
                                                              "}";

// Amount in ms to sleep between querying state from DPS registration loop
static const int dpsRegistrationPollSleep = 100;

// Maximum amount of times we'll poll for DPS registration being ready, 1 min.
static const int dpsRegistrationMaxPolls = (60 * 1000 / dpsRegistrationPollSleep);

// State of DigitalTwin registration process.  We cannot proceed with DigitalTwin until we get into the state APP_DIGITALTWIN_REGISTRATION_SUCCEEDED.
typedef enum APP_DIGITALTWIN_REGISTRATION_STATUS_TAG
{
    APP_DIGITALTWIN_REGISTRATION_PENDING,
    APP_DIGITALTWIN_REGISTRATION_SUCCEEDED,
    APP_DIGITALTWIN_REGISTRATION_FAILED
} APP_DIGITALTWIN_REGISTRATION_STATUS;

#define IOT_HUB_CONN_STR_MAX_LEN 512

static char *dpsIotHubUri;
static char *dpsDeviceId;

static bool parseDPSConnectionString(const char *connection_string)
{
    if (connection_string == NULL)
    {
        LogError("connection_string is NULL");
        return false;
    }
    MAP_HANDLE connection_string_values_map;
    if ((connection_string_values_map = connectionstringparser_parse_from_char(connection_string)) == NULL)
    {
        LogError("Tokenizing failed on connectionString");
        return false;
    }
    const char *_globalDpsEndpoint = Map_GetValueFromKey(connection_string_values_map, IOTHUBDPS_ENDPOINT);
    const char *_dpsIdScope = Map_GetValueFromKey(connection_string_values_map, IOTHUBDPS_SCOPEID);
    const char *_sasKey = Map_GetValueFromKey(connection_string_values_map, IOTHUBDPS_SYMMETRICKEY);
    const char *_registrationId = Map_GetValueFromKey(connection_string_values_map, IOTHUBDPS_REGISTRATIONID);
    if (_globalDpsEndpoint)
    {
        mallocAndStrcpy_s(&globalDpsEndpoint, _globalDpsEndpoint);
    }
    else
    {
        LogError("Couldn't find %s in connection string", IOTHUBDPS_ENDPOINT);
    }
    if (_dpsIdScope)
    {
        mallocAndStrcpy_s(&dpsIdScope, _dpsIdScope);
    }
    else
    {
        LogError("Couldn't find %s in connection string", IOTHUBDPS_SCOPEID);
    }
    if (_sasKey)
    {
        mallocAndStrcpy_s(&sasKey, _sasKey);
    }
    else
    {
        LogError("Couldn't find %s in connection string", IOTHUBDPS_SYMMETRICKEY);
    }
    if (_registrationId)
    {
        mallocAndStrcpy_s(&deviceId, _registrationId);
    }
    else
    {
        LogError("Couldn't find %s in connection string", IOTHUBDPS_REGISTRATIONID);
    }  
    Map_Destroy(connection_string_values_map);

    if (globalDpsEndpoint == NULL || dpsIdScope == NULL || sasKey == NULL || deviceId == NULL)
    {
        return false;
    }
    return true;
}

static void provisioningRegisterCallback(PROV_DEVICE_RESULT register_result, const char *iothub_uri, const char *device_id, void *user_context)
{
    APP_DPS_REGISTRATION_STATUS *appDpsRegistrationStatus = (APP_DPS_REGISTRATION_STATUS *)user_context;

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

static bool registerDevice(bool traceOn)
{
    PROV_DEVICE_RESULT provDeviceResult;
    PROV_DEVICE_LL_HANDLE provDeviceLLHandle = NULL;
    bool result = false;

    APP_DPS_REGISTRATION_STATUS appDpsRegistrationStatus = APP_DPS_REGISTRATION_PENDING;

    if (IoTHub_Init() != 0)
    {
        LogError("IoTHub_Init failed");
        return false;
    }

    const char *connectionString = getIoTHubConnectionString();
    if (!parseDPSConnectionString(connectionString))
    {
        return false;
    }

    if (prov_dev_set_symmetric_key_info(deviceId, sasKey) != 0)
    {
        LogError("prov_dev_set_symmetric_key_info failed.");
    }
    else if (prov_dev_security_init(secureDeviceTypeForProvisioning) != 0)
    {
        LogError("prov_dev_security_init failed");
    }
    else if ((provDeviceLLHandle = Prov_Device_LL_Create(globalDpsEndpoint, dpsIdScope, Prov_Device_MQTT_Protocol)) == NULL)
    {
        LogError("failed calling Prov_Device_Create");
    }
    else if ((provDeviceResult = Prov_Device_LL_SetOption(provDeviceLLHandle, PROV_OPTION_LOG_TRACE, &traceOn)) != PROV_DEVICE_RESULT_OK)
    {
        LogError("Setting provisioning tracing on failed, error=%d", provDeviceResult);
    }
    else if ((provDeviceResult = Prov_Device_LL_SetOption(provDeviceLLHandle, "TrustedCerts", certificates)) != PROV_DEVICE_RESULT_OK)
    {
        LogError("Setting provisioning TrustedCerts failed, error=%d", provDeviceResult);
    }
    else if ((provDeviceResult = Prov_Device_LL_Set_Provisioning_Payload(provDeviceLLHandle, digitalTwinSample_CustomProvisioningData)) != PROV_DEVICE_RESULT_OK)
    {
        LogError("Failed setting provisioning data, error=%d", provDeviceResult);
    }
    else if ((provDeviceResult = Prov_Device_LL_Register_Device(provDeviceLLHandle, provisioningRegisterCallback, &appDpsRegistrationStatus, NULL, NULL)) != PROV_DEVICE_RESULT_OK)
    {
        LogError("Prov_Device_Register_Device failed, error=%d", provDeviceResult);
    }
    else
    {
        // Pulling the registration status
        for (int i = 0; (i < dpsRegistrationMaxPolls) && (appDpsRegistrationStatus == APP_DPS_REGISTRATION_PENDING); i++)
        {
            ThreadAPI_Sleep(dpsRegistrationPollSleep);
            Prov_Device_LL_DoWork(provDeviceLLHandle);
        }

        if (appDpsRegistrationStatus == APP_DPS_REGISTRATION_SUCCEEDED)
        {
            LogInfo("DPS successfully registered.  Continuing on to creation of IoTHub device client handle.");
            result = true;
        }
        else if (appDpsRegistrationStatus == APP_DPS_REGISTRATION_PENDING)
        {
            LogError("Timed out attempting to register DPS device");
        }
        else
        {
            LogError("Error registering device for DPS");
        }
    }

    if (provDeviceLLHandle != NULL)
    {
        Prov_Device_LL_Destroy(provDeviceLLHandle);
    }
    IoTHub_Deinit();

    return result;
}

void setup()
{
    char buff[IOT_HUB_CONN_STR_MAX_LEN];

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
    if (registerDevice(false))
    {
        Screen.print(1, "Connecting\r\n IoT Hub...");

        buff[0] = 0;
        if (secureDeviceTypeForProvisioning == SECURE_DEVICE_TYPE_SYMMETRIC_KEY)
        {
            snprintf(buff, sizeof(buff),
                     "HostName=%s;DeviceId=%s;SharedAccessKey=%s",
                     dpsIotHubUri,
                     dpsDeviceId,
                     sasKey);
        }
        else if (secureDeviceTypeForProvisioning == SECURE_DEVICE_TYPE_X509)
        {
            snprintf(buff, sizeof(buff),
                     "HostName=%s;DeviceId=%s;UseProvisioning=true",
                     dpsIotHubUri,
                     dpsDeviceId);
        }
        
        if (pnp_device_initialize(buff, certificates) != 0)
        {
            digitalWrite(LED_AZURE, 0);
            Screen.print(1, "Error: \r\nIoT Hub is not\r\navailable.");
            iotHubConnected = false;
        }
        else
        {
            digitalWrite(LED_AZURE, 1);
            Screen.print(1, "PnP Enabled\r\nRunning...");
            iotHubConnected = true;
        }
    }
    else
    {
        digitalWrite(LED_AZURE, 0);
        Screen.print(1, "Error: \r\nRegistering\r\ndevice failed.\r\n");
        iotHubConnected = false;
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
