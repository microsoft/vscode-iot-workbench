#include <WiFi.h>
#include <stdio.h>
#include <stdlib.h>
#include "iothub_client.h"
#include "iothub_message.h"
#include "azure_c_shared_utility/threadapi.h"
#include "azure_c_shared_utility/crt_abstractions.h"
#include "azure_c_shared_utility/platform.h"
#include "iothubtransportmqtt.h"
#include "azureiotcerts.h"

// Please input the SSID and password of WiFi
const char* ssid     = "";
const char* password = "";

/*String containing Hostname, Device Id & Device Key in the format:                         */
/*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessKey=<device_key>"                */
/*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessSignature=<device_sas_token>"    */
static const char* connectionString = "";

static char msgText[1024];
static int callbackCounter;
IOTHUB_CLIENT_LL_HANDLE iotHubClientHandle;
int receiveContext = 0;
static char propText[1024];
static size_t tackingIdIndex = 0;
static bool confirmReceived = false;

typedef struct EVENT_INSTANCE_TAG
{
    IOTHUB_MESSAGE_HANDLE messageHandle;
    int messageTrackingId; // For tracking the messages within the user callback.
} EVENT_INSTANCE;
static EVENT_INSTANCE currentMessage;


static unsigned char* bytearray_to_str(const unsigned char *buffer, size_t len)
{
    unsigned char* ret = (unsigned char*)malloc(len+1);
    memcpy(ret, buffer, len);
    ret[len] = '\0';
    return ret;
}

static void SendConfirmationCallback(IOTHUB_CLIENT_CONFIRMATION_RESULT result, void* userContextCallback)
{
    EVENT_INSTANCE* eventInstance = (EVENT_INSTANCE*)userContextCallback;
    size_t id = eventInstance->messageTrackingId;
    
    (void)printf("Confirmation[%d] received for message tracking id = %d with result = %s\r\n", callbackCounter, (int)id, ENUM_TO_STRING(IOTHUB_CLIENT_CONFIRMATION_RESULT, result));
    /* Some device specific action code goes here... */
    confirmReceived = true;
    callbackCounter++;
    IoTHubMessage_Destroy(eventInstance->messageHandle);
}

static IOTHUBMESSAGE_DISPOSITION_RESULT ReceiveMessageCallback(IOTHUB_MESSAGE_HANDLE message, void *userContextCallback)
{
    int *counter = (int *)userContextCallback;
    const char *buffer;
    size_t size;
    MAP_HANDLE mapProperties;

    // Message content
    if (IoTHubMessage_GetByteArray(message, (const unsigned char **)&buffer, &size) != IOTHUB_MESSAGE_OK)
    {
        (void)printf("unable to retrieve the message data\r\n");
    }
    else
    {
        unsigned char* message_string = bytearray_to_str((const unsigned char *)buffer, size);
        (void)printf("IoTHubMessage_GetByteArray received message: \"%s\" \n", message_string);
        free(message_string);
    }

    /* Some device specific action code goes here... */
    (*counter)++;
    return IOTHUBMESSAGE_ACCEPTED;
}

void iot_hub_mqtt_example_init()
{
    callbackCounter = 0;
    
    srand((unsigned int)time(NULL));

    if (platform_init() != 0)
    {
        (void)printf("Failed to initialize the platform.\r\n");
        return;
    }
    
    if ((iotHubClientHandle = IoTHubClient_LL_CreateFromConnectionString((char*)connectionString, MQTT_Protocol)) == NULL)
    {
        (void)printf("ERROR: iotHubClientHandle is NULL!\r\n");
        return;
    }

    bool traceOn = true;
    IoTHubClient_LL_SetOption(iotHubClientHandle, "logtrace", &traceOn);

    /* Setting Message call back, so we can receive Commands. */
    if (IoTHubClient_LL_SetMessageCallback(iotHubClientHandle, ReceiveMessageCallback, &receiveContext) != IOTHUB_CLIENT_OK)
    {
        (void)printf("ERROR: IoTHubClient_LL_SetMessageCallback..........FAILED!\r\n");
        return;
    }
}

void iot_hub_mqtt_example_send_event(const unsigned char *text)
{
    currentMessage.messageHandle = IoTHubMessage_CreateFromByteArray(text, strlen((const char*)text));
    currentMessage.messageTrackingId = tackingIdIndex;
    tackingIdIndex++;
    if (currentMessage.messageHandle == NULL) {
        (void)printf("ERROR: iotHubMessageHandle is NULL!\r\n");
        return;
    }

    MAP_HANDLE propMap = IoTHubMessage_Properties(currentMessage.messageHandle);
    (void)sprintf_s(propText, sizeof(propText), "PropMsg_%d", currentMessage.messageTrackingId);
    if (Map_AddOrUpdate(propMap, "PropName", propText) != MAP_OK)
    {
         (void)printf("ERROR: Map_AddOrUpdate Failed!\r\n");
         return;
    }

    if (IoTHubClient_LL_SendEventAsync(iotHubClientHandle, currentMessage.messageHandle, SendConfirmationCallback, &currentMessage) != IOTHUB_CLIENT_OK)
    {
        (void)printf("ERROR: IoTHubClient_LL_SendEventAsync..........FAILED!\r\n");
        return;
    }
    confirmReceived = false;
    (void)printf("IoTHubClient_LL_SendEventAsync accepted messagefor transmission to IoT Hub.\r\n");
}

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  delay(10);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
  }
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
  iot_hub_mqtt_example_init();
}

void loop() {
    sprintf(msgText, "{\"topic\":\"%s\"}", "#iot");
    iot_hub_mqtt_example_send_event((const unsigned char *)msgText);
    while(true)
    {
        IoTHubClient_LL_DoWork(iotHubClientHandle);
        
        if (confirmReceived)
        {
            // IoT Hub got this event
            delay(5000);
            return;
        }
        delay(100);
    }
}
