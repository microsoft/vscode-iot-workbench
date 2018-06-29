# Get Started with Raspberry Pi

Follow these quick steps to:
- Prepare your development environment.
- Send magnetoresistive sensor data from GY-271 electronic compass to the Azure IoT Hub.

## What you learn

* How to install the development environment.
* How to create an IoT Hub and register a device for Raspberry Pi.
* How to collect sensor data by running a sample application on Raspberry Pi.
* How to send sensor data to your IoT hub.

## What you need

* A Raspberry Pi.
* A GY-271 electronic compass.
* A computer running Windows 10 or macOS 10.10+.
* An active Azure subscription. [Activate a free 30-day trial Microsoft Azure account](https://azure.microsoft.com/en-us/free/).

![Required hardware](media/raspi-get-started/hardware.jpg)

## Prepare your hardware

Connect GY-271 to Raspberry Pi:

You can find Raspberry Pi GPIO pin mapping from <https://www.raspberrypi.org/documentation/usage/gpio/>.

GY-271 has 5 pins: VCC, GND, SCL, SDA and DRDY. Connect them to Raspberry Pi GPIO pins as below table:

| GY-271 Pin | Raspberry Pi GPIO |
| ---------- | ----------------- |
| VCC        | 3.3v              |
| GND        | Ground            |
| SCL        | 3                 |
| SDA        | 2                 |
| DRDY       | Not Connect       |

![Hardware connections](media/raspi-get-started/connect.jpg)

## Install development environment

Azure IoT Workbench provides an integrated experience to develop IoT solutions. It helps both on device and cloud development using Azure IoT and other services. You can watch this [Channel9 video](https://channel9.msdn.com/Shows/Internet-of-Things-Show/IoT-Workbench-extension-for-VS-Code) to have an overview of what it does.

Follow these steps to prepare the development environment for Raspberry Pi:

1. Install [Visual Studio Code](https://code.visualstudio.com/), a cross platform source code editor with powerful developer tooling, like IntelliSense code completion and debugging.

2. Look for **Azure IoT Workbench** in the extension marketplace and install it.

  ![Install IoT Workbench](media/raspi-get-started/install-workbench.png)

Together with the IoT Workbench, other dependent extensions will be installed.

## Build your first project

Now you are all set with preparing and configuring your development environment. Let us build a "Hello World" sample for IoT: sending temperature telemetry data to Azure IoT Hub.

### Open IoT Workbench Examples

Use `F1` or`Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) to open the command palette, type **IoT Workbench**, and then select **IoT Workbench: Examples**.

![IoT Workbench: Examples](media/iot-workbench-examples-cmd.png)

Select **Raspberry**.
    
![IoT Workbench: Examples -> Select board](media/iot-workbench-examples-board.png)

Then the **IoT Workbench Example** window is showed up.
    
![IoT Workbench, Examples window](media/iot-workbench-examples.png)

Find **Get Started** and click **Open Sample** button. A new VS Code window with a project folder in it opens.

![Open sample](media/raspi-get-started/open-sample.png)

### Provision Azure service

In the solution window, open the command palette and select **IoT Workbench: Cloud**.

![IoT Workbench: Cloud](media/iot-workbench-cloud.png)

Select **Azure Provision**.

![IoT Workbench: Cloud -> Provision](media/iot-workbench-cloud-provision.png)

Then VS Code guides you through provisioning the required Azure services.

![IoT Workbench: Cloud -> Provision steps](media/iot-workbench-cloud-provision-steps2.png)

The whole process includes:
* Select an existing IoT Hub or create a new IoT Hub.
* Select an existing IoT Hub device or create a new IoT Hub device. 

### Config IoT Hub Connection String

1. Open the command palette and select **IoT Workbench: Device**.

  ![IoT Workbench: Device](media/iot-workbench-device.png)

2. Select **Config Device Settings**.

  ![IoT Workbench: Device -> Settings](media/iot-workbench-device-settings.png)

3. Select **Select Config connection of IoT Hub Device**.

  ![IoT Workbench: Device -> Connection string](media/iot-workbench-device-string.png)

4. Select **Select IoT Hub Device Connection String**.

  ![IoT Workbench: Device -> Connection string](media/iot-workbench-device-string1.png)

   This sets the connection string that is retrieved from the `Provision Azure services` step.

5. The configuration success notification popup bottom right corner once it's done.

  ![Raspberry Pi Connection String OK](media/iot-workbench-connection-done.png) 

### Upload the device code

1. Open the command palette and select **IoT Workbench: Device**.

  ![IoT Workbench: Device](media/iot-workbench-device.png)

2. Select **Config Device Settings**.

  ![IoT Workbench: Device -> Settings](media/iot-workbench-device-settings.png)

3. Select **Select Config Raspberry Pi SSH**.

  ![IoT Workbench: Device -> SSH](media/iot-workbench-device-ssh.png)

4. Input Raspberry Pi host name or IP, ssh port, user name, password and project name.

5. Open the command palette and select **IoT Workbench: Device**, then select **Device Upload**.

  ![IoT Workbench: Device -> Upload](media/iot-workbench-device-upload.png)

6. VS Code then starts uploading the code to Raspberry Pi and install node modules.

7. Login Raspberry Pi and run node code.

## Test the project

You can use [Azure IoT Toolkit](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.azure-iot-toolkit) to monitor device-to-cloud (D2C) messages in IoT Hub:

1. Expand **AZURE IOT HUB DEVICES** on the bottom left corner, click the device that you have created at **Provision Azure service** step and open the context menu, then click **IoT: Start monitoring D2C message** in context menu.

  ![azure-iot-toolkit-output-console](media/raspi-get-started/monitor-d2c-message.png)

2. In **OUTPUT** pane, you can see the incoming D2C messages to the IoT Hub.

  ![azure-iot-toolkit-output-console](media/raspi-get-started/monitor-d2c-message-result.png)
