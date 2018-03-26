# Visual Studio Code extension for IoT Workbench 

Welcome to Visual Studio Code extension for **IoT Workbench** <sup>preview</sup> ! The iot workbench extension makes it easy to code, build, deploy and debug your IoT project for DevKit in Visual Studio Code, with a rich set of functionalities.

## Prerequisites
Arduino IDE is required. Please install it from [here](https://www.arduino.cc/en/main/software#download).
- The supported Arduino IDE versions are 1.6.x and later.
- The Windows Store's version of Arduino IDE is not supported because of the sandbox environment of Windows app.

## Installation
Open VS Code and press `F1` or `Ctrl + Shift + P` to open command palette, select **Install Extension** and click `install from VSIX...`.

In the file selection window, nevigate to the folder that contains 'vscode-iot-workbench-0.1.0.vsix', then select 'vscode-iot-workbenh-0.1.0.vsix'. 

After installation, please reload the window and make sure all the dependency extensions are correctly installed.

## Supported Operating Systems
Currently this extension supports the following operatings systems:

- Windows 7 and later (32-bit and 64-bit)
- macOS 10.10 and later

## Board-Specific Settings

### IoT DevKit

#### Prerequisites
ST-Link driver is required in Windows system. Please install it from [here](http://www.st.com/en/development-tools/stsw-link009.html).

#### Install IoT DevKit Package
1. Use `Ctrl+Shift+P` to open the command palette, type **Arduino**, and then find and select **Arduino: Board Manager**.

2. Select **Additional URLs** at the lower right.

3. In the `settings.json` file, add a line at the bottom of the **USER SETTINGS** pane and save.
 ```json
 "arduino.additionalUrls": "https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/master/package_azureboard_index.json"
 ```

4. Refresh package indexes and then in Board Manager, search for **az3166** and install the latest version.

## Features

* Create new IoT Workbench projects
  * Device only: Create project with device only code.

  * With Azure IoT Hub: Create project that connects to Azure IoT Hub, such as sending sensor data to cloud.

  * With Azure Functions: Create project that connects to Azure IoT Hub and process device data further in Azure Functions.

* Load existing IoT Workbench project of mini solutions.

  * Get_started: Send sensor data from DevKit to Azure IoT Hub.

  * DevKit_DPS: Automatically provision security enabled devices to Azure IoT Hub.

  * ShakeShake: Use the motion sensor to detect shaking and find a tweet with specified topic.

* Compile and upload device code.
* Set device connection string.
* Code snippet to improve develop experience.


## Privacy Statement
The [Microsft Enterprise and Developer Privacy Statement](https://www.microsoft.com/en-us/privacystatement/EnterpriseDev/default.aspx) describes the privacy statement of this software.

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

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct). For more information please see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/#howadopt) or contact opencode@microsoft.com with any additional questions or comments.

## Contact Us
If you would like to help to build the best IoT experience with VS Code, you can reach us directly at [gitter chat room](https://gitter.im/Microsoft/azure-iot-developer-kit).

## Telemetry
VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

Microsoft would like to collect data about how users use Azure IoT DevKit and some problems they encounter. Microsoft uses this information to improve our DevKit experience. Participation is voluntary and when you choose to participate, your device automatically sends information to Microsoft about how you use Azure IoT DevKit.

To disable telemetry on Azure IoT Devkit，

- Windows: set `-DENABLETRACE=0` in `C:\Users\{your name}\AppData\Local\Arduino15\packages\AZ3166\hardware\stm32f4\{version}\platform.local.txt`
- macOS： set `-DENABLETRACE=0` in `~/Library/Arduino15/packages/AZ3166/hardware/stm32f4/{version}/platform.local.txt`

