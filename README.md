# Visual Studio Code extension for IoT Dev Env 

Welcome to Visual Studio Code extension for **IoT Dev Env** <sup>preview</sup> ! The iot-dev-env extension makes it easy to code, build, deploy and debug your IoT project for DevKit in Visual Studio Code, with a rich set of functionalities.

## Prerequisites
Arduino IDE is required. Please install it from [here](https://www.arduino.cc/en/main/software#download).
- The supported Arduino IDE versions are 1.6.x and later.
- The Windows Store's version of Arduino IDE is not supported because of the sandbox environment of Windows app.

ST-Link driver is required in Windows system. Please install it from [here](http://www.st.com/en/development-tools/stsw-link009.html).

## Installation
Open VS Code and press `F1` or `Ctrl + Shift + P` to open command palette, select **Install Extension** and click `install from VSIX...`.

In the file selection window, nevigate to the folder that contains 'vscode-iot-dev-env-0.0.1.vsix', then select 'vscode-iot-dev-env-0.0.1.vsix'. 

After installation, please reload the window and make sure all the dependency extensions are correctly installed.

## Supported Operating Systems
Currently this extension supports the following operatings systems:

- Windows 7 and later (32-bit and 64-bit)
- macOS 10.10 and later

## Prepare Development Environment
1. Use `Ctrl+Shift+P` to open the command palette, type **Arduino**, and then find and select **Arduino: Board Manager**.

2. Select **Additional URLs** at the lower right.

3. In the `settings.json` file, add a line at the bottom of the **USER SETTINGS** pane and save.
 ```json
 "arduino.additionalUrls": "https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/master/package_azureboard_index.json"
 ```

4. In Board Manager, search for **az3166** and install the latest version.


## Privacy Statement
The [Microsft Enterprise and Developer Privacy Statement](https://www.microsoft.com/en-us/privacystatement/EnterpriseDev/default.aspx) describes the privacy statement of this software.

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct). For more information please see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/#howadopt) or contact opencode@microsoft.com with any additional questions or comments.

## Contact Us
If you would like to help build the best IoT experience with VS Code, you can reach us directly at [gitter chat room](https://gitter.im/Microsoft/azure-iot-developer-kit).