## IoT DevKit

#### Prerequisites
ST-Link driver is required on Windows. Please install it from [here](http://www.st.com/en/development-tools/stsw-link009.html).

#### Install IoT DevKit Package
1. Use `Ctrl + Shift + P` to open the command palette, type **IoT Workbench**, and then find and select **IoT Workbench: Device**.

2. Select **Install Device SDK** from the menu.

3. In the next menu, select **IoT DevKit** from the list.

4. Wait for installation of the package for IoT Devkit to finish.

#### Templates for IoT DevKit project

* Device only: Create project with device only code.

* With Azure IoT Hub: Create project that connects to Azure IoT Hub, such as sending sensor data to cloud.

* With Azure Functions: Create project that connects to Azure IoT Hub and process device data further in Azure Functions.

#### Telemetry

Microsoft would like to collect data about how users use Azure IoT DevKit and some problems they encounter. Microsoft uses this information to improve our IoT DevKit experience. Participation is voluntary and when you choose to participate, your device automatically sends information to Microsoft about how you use IoT DevKit.

To disable telemetry on IoT Devkit，

- Windows: set `-DENABLETRACE=0` in `%LOCALAPPDATA%\Arduino15\packages\AZ3166\hardware\stm32f4\{version}\platform.local.txt`
- macOS： set `-DENABLETRACE=0` in `~/Library/Arduino15/packages/AZ3166/hardware/stm32f4/{version}/platform.local.txt`