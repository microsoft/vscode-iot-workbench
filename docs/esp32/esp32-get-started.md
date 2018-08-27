# Get Started with ESP32 Devices

For first-time users of ESP32 devices, follow these quick steps to:
- Prepare your development environment.
- Send information from the device to the Azure IoT Hub 
- Use Azure Functions to process the data sent to Azure IoT Hub.

## What you learn

* How to install the development environment.
* How to create an IoT Hub and register a ESP32 device.
* How to send sample data to your IoT hub.

## What you need

* A ESP32 device. 
> Note: We use [M5Stack](www.m5stack.com) in this tutorial, but the steps below could also be applied to other ESP32 devices.
* A computer running Windows 10 or macOS 10.10+.
* An active Azure subscription. [Activate a free 30-day trial Microsoft Azure account](https://azure.microsoft.com/en-us/free/).

![Required hardware](media/esp32-get-started/hardware.jpg)

## Prepare your hardware

For M5Stack, please follow the [guide](http://www.m5stack.com/assets/docs/index.html) to prepare the hardware.

## Install development environment

We recommend [Azure IoT Workbench](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.vscode-iot-workbench) extension for Visual Studio Code to develop on the ESP32 devices.

Azure IoT Workbench provides an integrated experience to develop IoT solutions. It helps both on device and cloud development using Azure IoT and other services. You can watch this [Channel9 video](https://channel9.msdn.com/Shows/Internet-of-Things-Show/IoT-Workbench-extension-for-VS-Code) to have an overview of what it does.

Follow these steps to prepare the development environment for ESP32 devices:

1. Download and install [Arduino IDE](https://www.arduino.cc/en/Main/Software). It provides the necessary toolchain for compiling and uploading Arduino code.
   * Windows: Use Windows Installer version
   * macOS: Drag and drop the Arduino into `/Applications`
   * Ubuntu: Unzip it into `$HOME/Downloads/arduino-1.8.5`

2. Install [Visual Studio Code](https://code.visualstudio.com/), a cross platform source code editor with powerful developer tooling, like IntelliSense code completion and debugging.

3. Look for **Azure IoT Workbench** in the extension marketplace and install it.
    ![Install IoT Workbench](media/esp32-get-started/install-workbench.png)
    Together with the IoT Workbench, other dependent extensions will be installed.

4. Open **File > Preference > Settings** and add following lines to configure Arduino.

	* Windows

		```JSON
		"arduino.path": "C:\\Program Files (x86)\\Arduino",
		"arduino.additionalUrls": "https://dl.espressif.com/dl/package_esp32_index.json"
		```

	* macOS

		```JSON
		"arduino.path": "/Application",
		"arduino.additionalUrls": "https://dl.espressif.com/dl/package_esp32_index.json"
		```

	* Ubuntu

		```JSON
		"arduino.path": "/home/{username}/Downloads/arduino-1.8.5",
		"arduino.additionalUrls": "https://dl.espressif.com/dl/package_esp32_index.json"
		```

5. Use `F1` or `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) to open the command palette, type and select **Arduino: Board Manager**. Search for **esp32** and install the latest version.

    ![Install DevKit SDK](media/esp32-get-started/esp32-install-sdk.jpg)

## Build your first project

Now you are all set with preparing and configuring your development environment. Let us build a "Hello World" sample for IoT: sending sample telemetry data to Azure IoT Hub and use Azure Functions to process the data.
Make sure your device is **not connected** to your computer. Start VS Code first, and then connect the ESP32 device to your computer.

### Create a new IoT Workbench Project

Use `F1` or`Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) to open the command palette, type **IoT Workbench**, and then select **IoT Workbench: New**.

Then select **ESP32 Arduino**.
    
![IoT Workbench: New -> Select board](media/esp32-get-started/new-select-board.jpg)

Then select **With Azure Functions** as the project template.
    
![IoT Workbench, project template](media/esp32-get-started/project-template.jpg)

Provide the name of the **.ino** file and select **C#Script** as the Azure Functions language. VS Code would restart and open the created IoT Project.

![create project](media/esp32-get-started/create-project.png)

>Note: M5Stack-Core-ESP32 is set as the default board after the IoT project is created. To change the setting, use `F1` or `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) to open the command palette, type and select **Arduino: Board Config**. Change to use other ESP32 board in the **Arduino Board Configuration** window.

>![change board](media/esp32-get-started/change-board.png)

In the bottom right status bar, check the serial port with **Silicon Labs** is used.

![Select serial port](media/esp32-get-started/select-port.png)

### Provision Azure service

In the solution window, open the command palette and select **IoT Workbench: Cloud**.

![IoT Workbench: Cloud](media/iot-workbench-cloud.png)

Select **Azure Provision**.

![IoT Workbench: Cloud -> Provision](media/iot-workbench-cloud-provision.png)

Then VS Code guides you through provisioning the required Azure services.

![IoT Workbench: Cloud -> Provision steps](media/iot-workbench-cloud-provision-steps3.png)

The whole process includes:
* Select an existing IoT Hub or create a new IoT Hub.
* Select an existing IoT Hub device or create a new IoT Hub device. 
* Create a new Azure Functions application.

### Deploy Azure Functions

1. In Visual Studio Code, open the `run.csx` file (default named `Functions\IoTHubTrigger1\run.csx`) to view the code for your function. 

	The source code of the Azure Functions:

	```csharp
	using System;

	public static void Run(string myIoTHubMessage, TraceWriter log)
	{
		log.Info($"C# IoT Hub trigger function processed a message: {myIoTHubMessage}");
	}
				
	```
    > NOTE: In this tutorial, we will use this source code from Azure Functions template directly. User could always modify the code to meet their own business needs.

1. Press **F1** or **Ctrl + Shift + P** in Visual Studio Code - **IoT Workbench:Cloud** and click **Azure Deploy**. This command will deploy the function code to Azure Functions App.


### Config Device Code

1. Open the source file(.ino) for device code and update the following lines with your WiFi ssid and password:
    ```csharp
		// Please input the SSID and password of WiFi
		const char* ssid     = "";
		const char* password = "";
    ```

1. Open the command palette and select **IoT Workbench: Device**.

	![IoT Workbench: Device](media/iot-workbench-device.png)

1. Select **Config Device Settings**.

	![IoT Workbench: Device -> Settings](media/iot-workbench-device-settings.png)

1. Select **Copy device connection string**.

	![IoT Workbench: Device copy connection string](media/esp32-get-started/copy-connection-string.png)

   This copies the connection string that is retrieved from the `Provision Azure services` step.

1. Paste the device connection string into the following line in device code
    ```csharp
	/*String containing Hostname, Device Id & Device Key in the format:                         */
	/*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessKey=<device_key>"                */
	/*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessSignature=<device_sas_token>"    */
	static const char* connectionString = "";
    ```

### Build and upload the device code

1. Open the command palette and select **IoT Workbench: Device**, then select **Device Upload**.

	![IoT Workbench: Device -> Upload](media/iot-workbench-device-upload.png)

2. VS Code then starts verifying and uploading the code to your DevKit.

	![IoT Workbench: Device -> Uploaded](media/esp32-get-started/esp32-device-uploaded.png)

3. The ESP32 device reboots and starts running the code.

## Test the project

Open serial monitor:

The sample application is running successfully when you see the following results:

* The Serial Monitor displays the message sent to the IoT Hub.

![azure-iot-toolkit-output-console](media/esp32-get-started/monitor-d2c-message.png)

You can use [Azure Functions](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions) to monitor streaming log of Azure Functions execution:

1. Expand Azure Functions on the left bar, click the Subscription that you used in Provision Azure service step and open the Azure Functions, then right-click Functions: **Start streaming logs**.

	![!azure-functions streaming log](media/esp32-get-started/azure-function-streaming-log.png)

1. In **OUTPUT** pane, you can see the streaming logs from Azure Functions.

	![azure-iot-toolkit-output-console](media/esp32-get-started/azure-function-streaming-result.png)

## Problems and feedback

If you encounter problems, you can reach out to us from:
* [Gitter.im](https://gitter.im/Microsoft/vscode-iot-workbench)
