# Azure IoT Device Workbench for Visual Studio Code

[![Gitter](https://img.shields.io/badge/chat-on%20gitter-blue.svg)](https://gitter.im/Microsoft/vscode-iot-workbench)
[![Travis CI](https://travis-ci.org/Microsoft/vscode-iot-workbench.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-iot-workbench)

***[Azure IoT Device Workbench extension](https://aka.ms/iot-workbench) is now part of [Azure IoT Tools](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.azure-iot-tools) extension pack. We highly recommend installing [Azure IoT Tools](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.azure-iot-tools) extension pack, which makes it easy to discover and interact with Azure IoT Hub that power your IoT Edge and device applications.** This extension pack can help you:*

- *Develop and connect your [Azure IoT Applications](https://azure.microsoft.com/en-us/overview/iot/) to Azure. With this extension, you can interact with an Azure IoT Hub, manage connected devices, and enable distributed tracing for your Azure IoT applications.*
- *Develop and debug [Certifies Azure IoT Devices](https://catalog.azureiotsolutions.com/alldevices) (including [MXChip IoT DevKit](https://aka.ms/iot-devkit), [ESP32](https://catalog.azureiotsolutions.com/details?title=ESP32_DevKitC&source=all-devices-page), [Raspberry Pi](https://www.adafruit.com/category/288)) to Azure. This extension pack makes it easy to code, build, deploy and debug your IoT applications with popular IoT development boards.*
- *Develop and deploy artificial intelligence and your custom logic to [Azure IoT Edge](https://azure.microsoft.com/en-us/services/iot-edge/). This extension pack makes it easy to code, build, deploy, and debug your IoT Edge applications.*

## Overview

The **Azure IoT Device Workbench** is a Visual Studio Code extension that provides an integrated environment to code, build, deploy, and debug your IoT device project with multiple Azure services supported. The extension also supports working with [IoT Plug and Play](https://docs.microsoft.com/azure/iot-pnp/overview-iot-plug-and-play) by defining *device capability model* schemas and generating skeleton device code and projects.

## Installation

### Prerequisites

For developing on an embedded Linux device, you need Docker and Visual Studio Code with [Visual Studio Code Remote Development](https://aka.ms/vscode-remote) to compile the device code in the [containerized device toolchain](https://aka.ms/iot-device-cube).

- [Visual Studio Code](https://code.visualstudio.com/), with version >= 1.36.1.
- [Docker Desktop / CE](https://www.docker.com/get-started).

### Install extensions

1. Launch VS Code, in the Extension tab, find and install **"Azure IoT Device Workbench"**.
    <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/device-workbench.png" />

2. Reload the window and make sure all the dependency extensions are correctly installed:

   - Azure Account
   - Azure IoT Hub Toolkit
   - C/C++
   - IoT Device Cube
   - Remote Development

### Install Docker

If you are developing on embedded Linux for [ARM Cortex-A series](https://developer.arm.com/ip-products/processors/cortex-a) devices, you need to install and configure Docker in order to use a container as a compiling environment. [VS Code Remote](https://aka.ms/vscode-remote) is the technology that enables this experience. You can skip this step if you are developing for Arduino or ESP32 devices.

- Install Docker Desktop for Windows

  Follow the [installation guide](https://docs.docker.com/docker-for-windows/install/) and make sure to enable driver sharing for Docker to access your local folder:

  1. Right click the **Docker** icon in the task tray and select "Settings".
  2. Click on the "Shared Drivers" section and choose the driver to be shared.

    <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/shared-drivers.png" />

- Install Docker Desktop for Mac

  Follow the [installation guide](https://docs.docker.com/docker-for-mac/install/) and make sure to enable driver sharing for Docker to access your local folder, which is enabled by default.

- Get Docker for Linux

  Linux is a highly variable environment and the large number of server, container, and desktop distributions can make it difficult to know what is supported. Check this [tutorial](https://code.visualstudio.com/docs/remote/linux) for Linux support.

## Develop device using IoT Plug and Play

The Azure IoT Device Workbench extension provides an integrated environment to author IoT Plug and Play *device capability models (DCM)* and *interfaces*, publish to model repositories, and generate skeleton C code to implement the device application.

Follow these links to get started with IoT Plug and Play and to learn how to use the Device Workbench extension to build an IoT Plug and Play device:

- [What is IoT Plug and Play](https://docs.microsoft.com/azure/iot-pnp/overview-iot-plug-and-play) and the [Digital Twin Definition Language (DTDL)](https://aka.ms/DTDL) that enables it.
- [Quickstart: Use a device capability model to create an IoT Plug and Play device](https://docs.microsoft.com/azure/iot-pnp/quickstart-create-pnp-device)
- [Build an IoT Plug and Play Preview device that's ready for certification](https://docs.microsoft.com/azure/iot-pnp/tutorial-build-device-certification)
- [Use Azure IoT Device Workbench extension in Visual Studio Code](https://docs.microsoft.com/azure/iot-pnp/howto-use-iot-device-workbench)
- [Connect an MXChip IoT DevKit device to your Azure IoT Central application via IoT Plug and Play](https://docs.microsoft.com/azure/iot-central/howto-connect-devkit-pnp)

## Develop generic device

Azure IoT Device Workbench aims to support multiple device platforms. Currently the following device platforms and languages are supported.

Please take the [survey](https://www.surveymonkey.com/r/C7NY7KJ) to let us know extra device platforms and languages you want to see support in Device Workbench.

### Embedded Linux <sup>public preview</sup>

To simplify the cross-compiling tool chain, Azure IoT Device SDK and dependencies setup and configuration, the Device Workbench extension puts all these components in a container. All cross-compiling work happens in the container. Here is a quickstart that shows how to develop and compile a simple device app written in C and running on [Raspberry Pi 3 Model B+](https://www.raspberrypi.org/products/raspberry-pi-3-model-b-plus/) to send telemetry data to Azure IoT Hub.

Languages supported: `C/C++`

Devices supported: [Cortex-A series](https://developer.arm.com/ip-products/processors/cortex-a) devices (e.g. Raspberry Pi, NXP i.MX6) that are running embedded Linux such as Debian, Ubuntu or Yocto Linux.

#### Create new project

1. Within VS Code, press `F1` to open the command palette, then type and select **Azure IoT Device Workbench: Create Project...**.

2. Enter the name of your project.

3. Select **Embedded Linux** from device platform list.

4. Select the dev container based on your target device, in this sample, select **32-bit Armv7 Cortex-A** for Raspberry Pi 3 Model B+ running [Raspbian](https://www.raspberrypi.org/downloads/raspbian/).

5. The first time you use a container, it takes around 1 to 3 minutes to download and prepare the dev container. Click the **details** link on the notification for the progress:
    <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/prepare-dev-container.png" />

6. Once the dev container is ready, you can see the status in the status bar and output window:
    <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/dev-container-ready.png" />

#### Compile the code

1. The `iothub_sample.c` under the `src` subfolder is the source file that contains the application logic. You can modify or add your own code in this file:
    <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/iothub-sample.png" />

2. To compile the code, press `F1`, type and select **Azure IoT Device Workbench: Compile Device Code** from the command palette.

3. The cross-compiling of the code happens in the dev container. Once it's done, it shows the notification:
    <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/compile-success.png" />

4. The compiled binary file is located in the `.build` folder.

#### Upload to target device

1. Before you upload the executable binary file to the target device, make sure:

   - The running OS on the device is correct (e.g. Raspbian running on Raspberry Pi 3 Model B+).
   - SSH is enabled on the device. Follow these [instructions](https://itsfoss.com/ssh-into-raspberry/) to do so.
   - Get the IP address of the device so that you can deploy the compiled binary to the device using SSH.

2. In VS Code, press `F1`, type and select **Azure IoT Device Workbench: Upload Device Code** from the command palette, then select **Manual setup** and enter the IP address, port, user name and password to deploy the compiled binary via SSH to Raspberry Pi:

   <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/upload-options.png" width=540 />

#### Verify the result

1. To start running the deployed binary, SSH into your Raspberry Pi device. You can follow these [instructions](https://itsfoss.com/ssh-into-raspberry/) to do so.

2. You need to pass the device connection string as a parameter to run the app, follow [this guide](./docs/create-iothub-device.md) to use Azure IoT Hub Toolkit to do so.

3. Run `azure_iot_app [connection string]` and you see the Raspberry Pi start sending telemetry data to the Azure IoT Hub:
    <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/result.png" />

4. To verify the reception of the data, use Azure IoT Hub Toolkit, right click on the device and select **Start Monitoring Built-in Event Endpoint**. In the output window, you can see that IoT Hub gets telemetry data sent from Raspberry Pi:
    <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/iothub-d2c.png" />

### Arduino

Currently, Device Workbench supports MXChip IoT DevKit and ESP32 DevKits using Arduino. For generic Arduino device, we recommend you use [Arduino extension in VS Code](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.vscode-arduino).

Languages supported: `Arduino C/C++`

Devices supported:

- [MXChip IoT DevKit](https://aka.ms/iot-devkit)
- [ESP32](https://www.espressif.com/en/products/hardware/esp-wroom-32/overview)

> The Device Workbench relies on Arduino IDE as a dependency to develop on the above devices. If you have installed Device Workbench prior to Arduino IDE, you may need to restart VS Code to make it find the Arduino IDE installation path correctly.

#### MXChip IoT DevKit

Follow the [setup guide](https://docs.microsoft.com/azure/iot-hub/iot-hub-arduino-iot-devkit-az3166-get-started#prepare-the-development-environment) to setup the environment including the Arduino extension.

Here are a set of tutorials to help you get started:

- [Get Started](https://docs.microsoft.com/azure/iot-hub/iot-hub-arduino-iot-devkit-az3166-get-started)
- [Use Azure IoT Hub Device Provisioning Service auto-provisioning device with IoT Hub](https://docs.microsoft.com/azure/iot-dps/how-to-connect-mxchip-iot-devkit)
- [Connect to the Remote Monitoring solution accelerator](https://docs.microsoft.com/azure/iot-accelerators/iot-accelerators-arduino-iot-devkit-az3166-devkit-remote-monitoring-v2)
- [Translate voice message with Azure Cognitive Services](https://docs.microsoft.com/azure/iot-hub/iot-hub-arduino-iot-devkit-az3166-translator)
- [Retrieve a Twitter message with Azure Functions](https://docs.microsoft.com/azure/iot-hub/iot-hub-arduino-iot-devkit-az3166-retrieve-twitter-message)
- [Send messages to an MQTT server using Eclipse Paho APIs](https://docs.microsoft.com/azure/iot-hub/iot-hub-arduino-iot-devkit-az3166-mqtt-helloworld)
- [DevKit State](./docs/iot-devkit/devkit-state.md)
- [Door Monitor](./docs/iot-devkit/devkit_door_monitor.md)
- [DevKit OTA](./docs/iot-devkit/devkit-ota.md)
- [Stream Analytics and Cosmos DB](./docs/iot-devkit/devkit-stream-analytics-cosmos-db.md)

#### ESP32

Follow the [setup guide](docs/esp32.md) to setup ESP32 device including the Arduino extension.

Here are a set of tutorials to help you get started:

- [Get Started](./docs/esp32/esp32-get-started.md)
- [Stream Analytics and Cosmos DB](./docs/esp32/esp32-stream-analytics-cosmos-db.md)
- [ESP32 State](./docs/esp32/esp32-state.md)
- [M5Stack Email Receiver](./docs/esp32/m5stack-email-receiver.md)

## Commands

### IoT Plug and Play

| Command | Description |
| --- | --- |
| `IoT Plug and Play: Create Capability Model...`  | Create new IoT Plug and Play device capability model file. |
| `IoT Plug and Play: Create Interface...` | Create new IoT Plug and Play interface file. |
| `IoT Plug and Play: Generate Device Code Stub...` | Generate skeleton device code and project based on given device capability model file. |
| `IoT Plug and Play: Open Model Repository...`  | Open Public or Company Model Repository view to manage device model files. |
| `IoT Plug and Play: Submit files to Model Repository...`  | Submit files to model repository. |
| `IoT Plug and Play: Sign out Model Repository`  | Sign out the Company Model Repository. |

### Generic device development

| Command | Description |
| --- | --- |
| `Azure IoT Device Workbench: Create Project...`  | Create new IoT Device Workbench projects. |
| `Azure IoT Device Workbench: Open Examples...` | Load existing examples of IoT Device Workbench project. |
| `Azure IoT Device Workbench: Provision Azure Services...` | Provision Azure services for current project. |
| `Azure IoT Device Workbench: Deploy to Azure...`  | Deploy the code of the Azure services. |
| `Azure IoT Device Workbench: Compile Device Code`  | Compile device code. |
| `Azure IoT Device Workbench: Upload Device Code`  | Compile and upload device code. |
| `Azure IoT Device Workbench: Configure Device Settings...`  | Manage the settings on the device. |
| `Azure IoT Device Workbench: Set Workbench Path` | Set the default path for Azure IoT Device Workbench. |
| `Azure IoT Device Workbench: Help` | Get help for Azure IoT Device Workbench. |

### Open Examples

<img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/open-examples.gif" />

### Provision Azure Services

<img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/provision.gif" />

#### Note: 
-  When invoking the **Azure IoT Device Workbench: Provision Azure Services...** command with Azure IoT Hub and Azure Functions, by default, Azure Functions use the IoT Hub consumer group of `$Default`. To switch to another consumer group, please follow the [guide](https://docs.microsoft.com/azure/iot-hub/iot-hub-create-through-portal) to create a new consumer group in Azure Portal. Then in the IoT project, modify the following setting in **function.json**:
    ```
    "consumerGroup": "[consumer_group_name]"
    ```
-  You can open an existing IoT project after you close it. To do so:
    -  In the menu of **Visual Studio Code**, choose *File -> Open Workspace...* .
    -  In file selection panel, navigate to the folder that contains your project and select *{PROJECT_NAME}.code-project*.

        <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/pic/openexisting.png" />

    -  Click **Open**.

## Documentation

- [FAQ](https://github.com/microsoft/vscode-iot-workbench/wiki/FAQ)
- [MXChip IoT DevKit](https://aka.ms/iot-devkit)

## Privacy Statement
The [Microsft Enterprise and Developer Privacy Statement](https://www.microsoft.com/privacystatement/EnterpriseDev/default.aspx) describes the privacy statement of this software.

## Contributing
There are a couple of ways you can contribute to this repo:

- **Ideas, feature requests and bugs**: We are open to all ideas and we want to get rid of bugs! Use the Issues section to either report a new issue, provide your ideas or contribute to existing threads.
- **Documentation**: Found a typo or strangely worded sentences? Submit a PR!
- **Code**: Contribute bug fixes, features or design changes:
  - Clone the repository locally and open in VS Code.
  - Install [TSLint for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=eg2.tslint).
  - Open the terminal (press <code>Ctrl + &#96;</code>) and run `npm install`.
  - To build, press `F1` and type in `Tasks: Run Build Task`.
  - Debug: press `F5` to start debugging the extension.
  - Run `gts check` and `gts fix` to follow TypeScript style guide.  
- **Example**: Contribute examples for the supported devices.

  - Create a git repo to host the code of your example project.
  - Write a tutorial to describe how to run the example.
  - Submit a [new issue](https://github.com/Microsoft/vscode-iot-workbench/issues/new) and provide the following information:
  
    | Item | Description |
    | --- | --- |
    | `Name` | Name of the example to be displayed in example gallery. |
    | `Description` | A short statement to describe the example. |
    | `Location` | URL of the GitHub repo. |
    | `Image` | URL of the example image (size: 640*370) shown in the gallery, if not provided, the default image will be used. |
    | `Tutorial` | URL of tutorial that describes how to run the example. |
    | `Difficulty` | Difficulty of the example, easy, medium or difficult. |

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct). For more information please see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/#howadopt) or contact opencode@microsoft.com with any additional questions or comments.

## Contact Us

If you would like to help to build the best IoT experience with Azure IoT Device Workbench, you can reach us directly at [Gitter](https://gitter.im/Microsoft/vscode-iot-workbench).

## Telemetry

VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).