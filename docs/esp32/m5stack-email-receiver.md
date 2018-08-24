# Stream Analytics and Cosmos DB

In this tutorial, you will learn how to send data to Stream Analytics Job and export it to Cosmos DB with Azure Stream Analytics Query Langauge.

## What you need

Finish the [Getting Started Guide](./devkit-get-started.md) to:

- Have your DevKit connected to Wi-Fi.
- Prepare the development environment.

An active Azure subscription. If you do not have one, you can register via one of these two methods:

- Activate a [free 30-day trial Microsoft Azure account](https://azure.microsoft.com/free/).
- Claim your [Azure credit](https://azure.microsoft.com/pricing/member-offers/msdn-benefits-details/) if you are MSDN or Visual Studio subscriber.


## Open the project folder

### Start VS Code

- Start Visual Studio Code.
- Make sure [Azure IoT Workbench](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.vscode-iot-workbench) is installed.
- Connect Esp32 to your PC.

### Open IoT Workbench Examples

Use `F1` or `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) to open the command palette, type **IoT Workbench**, and then select **IoT Workbench: Examples**.

![IoT Workbench: Examples](media/iot-workbench-examples-cmd.png)

Select **ESP32 Arduino**.

![IoT Workbench: Examples -> Select board](media/iot-workbench-examples-board.png)

Then the **IoT Workbench Example** window is showed up.

![IoT Workbench, Examples window](media/iot-workbench-examples.png)

Find **M5Stack Email Receiver** and click **Open Sample** button. A new VS Code window with a project folder in it opens.

![IoT Workbench, select M5Stack Email Receiver example](media/devkit-state/open-example-devkitstate.jpg)

## Provision Azure Services

In the solution window, open the command palette and select **IoT Workbench: Cloud**.

![IoT Workbench: Cloud](media/iot-workbench-cloud.png)

Select **Azure Provision**.

![IoT Workbench: Cloud -> Provision](media/iot-workbench-cloud-provision.png)

Then VS Code guides you through provisioning the required Azure services.

![IoT Workbench: Cloud -> Provision steps](media/iot-workbench-cloud-provision-steps3.png)

The whole process includes:

- Select an existing IoT Hub or create a new IoT Hub.
- Select an existing IoT Hub device or create a new IoT Hub device. 
- Create a new Function App.

Please take a note of the Function App name and IoT Hub device name you created. It will be used in the next section.

## Modify code for Azure Functions
Open **esp32-state\run.csx** and modify the following line with the device name you provisioned in previous step:
```cpp
static string deviceName = "";
```

## Deploy Azure Functions

Open the command palette and select **IoT Workbench: Cloud**, then select **Azure Deploy**.

![IoT Workbench: Cloud -> Deploy](media/iot-workbench-cloud-deploy.png)


## Creating Azure Logic App

1. Open [Azure Portal](https://portal.azure.com)
2. Select the **+** or **Create a resource** button and under **Enterprise Integration** choose **Logic App**.
3. Give it a Name, Resource Group, and Region (any will do) and click **Create**.
4. After the logic app is created, open it.
5. The designer should automatically load - if not click the **Edit** button.
6. Select the **When an HTTP request is received** trigger.
7. Click **New Step** to add a step to the workflow and **Add an action**.
8. Search for the key word of **Send email** action.

## Config Device Code

1. Open the source file(.ino) for device code and update the following lines with your WiFi ssid and password:
    ```csharp
		// Please input the SSID and password of WiFi
		const char* ssid     = "";
		const char* password = "";
    ```

2. Open the command palette and select **IoT Workbench: Device**.

	![IoT Workbench: Device](media/iot-workbench-device.png)

3. Select **Config Device Settings**.

	![IoT Workbench: Device -> Settings](media/iot-workbench-device-settings.png)

4. Select **Copy device connection string**.

	![IoT Workbench: Device copy connection string](media/esp32-get-started/copy-connection-string.png)

   This copies the connection string that is retrieved from the `Provision Azure services` step.

5. Paste the device connection string into the following line in device code
    ```csharp
	/*String containing Hostname, Device Id & Device Key in the format:                         */
	/*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessKey=<device_key>"                */
	/*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessSignature=<device_sas_token>"    */
	static const char* connectionString = "";
    ```

## Build and upload the device code

1. Open the command palette and select **IoT Workbench: Device**, then select **Device Upload**.

	![IoT Workbench: Device -> Upload](media/iot-workbench-device-upload.png)

2. VS Code then starts verifying and uploading the code to your DevKit.

	![IoT Workbench: Device -> Uploaded](media/esp32-get-started/esp32-device-uploaded.png)

3. The M5Stack device reboots and starts running the code.


## Send Email to Gmail Account to test the project
