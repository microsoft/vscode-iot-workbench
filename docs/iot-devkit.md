## IoT DevKit

The [MXChip IoT DevKit](https://aka.ms/iot-devkit) is an all-in-one Arduino compatible board with rich peripherals and sensors. You can develop for it using [Azure IoT Workbench ](https://aka.ms/azure-iot-workbench). And it comes with a growing [projects catalog](https://aka.ms/devkit/project-catalog) to guide you prototype Internet of Things (IoT) solutions that take advantage of Microsoft Azure services.

#### Telemetry

Microsoft would like to collect data about how users use Azure IoT DevKit and some problems they encounter. Microsoft uses this information to improve our IoT DevKit experience. Participation is voluntary and when you choose to participate, your device automatically sends information to Microsoft about how you use IoT DevKit.

To disable telemetry on IoT Devkit，

- Windows
  set `-DENABLETRACE=0` in `%LOCALAPPDATA%\Arduino15\packages\AZ3166\hardware\stm32f4\{version}\platform.local.txt`
- macOS
  set `-DENABLETRACE=0` in `~/Library/Arduino15/packages/AZ3166/hardware/stm32f4/{version}/platform.local.txt`