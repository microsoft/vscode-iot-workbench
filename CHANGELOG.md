# Change Log

All notable changes to the "vscode-iot-workbench" extension will be documented in this file.

## Version 0.11.0

- Release data: January 2nd, 2020

## Changes

- Refine command flow of "**Azure IoT Device Workbench: Configure Development Container for CMake Project (preview)...**"
- Refine example landing page automatically popping up behaviour.
- Automatically configure Arduino project.

## Version 0.10.17

- Release data: November 22, 2019

### Fixed

- Fix serial port issue on configuring device settings.[[#829](https://github.com/microsoft/vscode-iot-workbench/issues/829)]
- Fix incorrect intellisense squiggles in armv7 container project.
- Fix c_cpp_properties.json auto-refresh issue.
- Fix model repo UI for displaying interface list.[[#809](https://github.com/microsoft/vscode-iot-workbench/issues/809)]

### Added

- Enable Vcpkg on containerized toolchain.

## Changes

- Integrate [latest Device C SDK](https://github.com/Azure/azure-iot-sdk-c/pull/1340/commits/1d0402c80944ec7ec24ed24314457166fef98814) bits into containerized docker images.
- Generate PnP code to send multiple telemetries defined in an interface in a single send.

## Version 0.10.16

- Release data: October 28, 2019

### Fixed

- Resolve compatibility issue with VS Code 1.39.
- Add c_cpp_properties.json for iot workbench example project.

### Added

- Support build with Vcpkg for PnP generated CMake project.
- Include source code of Azure IoT Device C SDK as sub-directory of the generated project.
- Update PnP CodeGen flow to allow configuring project template and IoT Device SDK reference type.
- Support configuration of device development environment for Arduino / Embedded Linux project.
- Support configuring an external cmake project to be an Embedded Linux IoT workbench project.
- Support uploading entire application output folder to target device.
- Support installing external libraries in development environment container.
- Support rename executable file name.
- Update docker images packaged with Azure IoT C SDK with Plug and Play feature.

## Version 0.10.15

- Release data: September 26, 2019

### Fixed
- Add delay() in DevKit IoTHub example

### Changes
- Improve CMakeLists.txt that generated for PnP Cmake project
- Rename DPS terminologies in generated device project
- Move hard-coded DPS credentials out of main.c
- Adjust DevKit and ESP32 example page

## Version 0.10.13

- Release data: August 20, 2019

### Fixed

- Fix wording issues
- Improve error handling

## Version 0.10.12

- Release data: August 12, 2019

### Added

We are excited to announce Azure IoT Device Workbench extension for VS Code support IoT Plug and Play Preview that enables:

- Create IoT Plug and Play *device capability model* and *interface* with sample schema, author with full IntelliSense features to support [Digital Twin Definition Language (DTDL) ](https://aka.ms/DTDL).
- Interact with IoT Plug an Play public model repository and company model repository, easy to list, download and publish *device capability model* and *interface*.
- Develop IoT hardware products more easily by generating skeleton ANSI C code and CMake projects from a *device capability model*.

Please check below topics for more information:

- [What is IoT Plug and Play](https://docs.microsoft.com/azure/iot-pnp/overview-iot-plug-and-play)
- [Quickstart: Use a device capability model to create an IoT Plug and Play device](https://docs.microsoft.com/azure/iot-pnp/quickstart-create-pnp-device)
- [Build an IoT Plug and Play Preview device that's ready for certification](https://docs.microsoft.com/azure/iot-pnp/tutorial-build-device-certification)
- [Use Azure IoT Device Workbench extension in Visual Studio Code](https://docs.microsoft.com/azure/iot-pnp/howto-use-iot-device-workbench)
- [Connect an MXChip IoT DevKit device to your Azure IoT Central application via IoT Plug and Play](https://docs.microsoft.com/azure/iot-central/howto-connect-devkit-pnp)

## Version 0.10.10

- Release date: August 4, 2019

### Added

Something great is going to happen, coming soon :)

## Version 0.3.1

- Release date: July 9, 2019

### Added

- We are excited to announce the preview of a new feature enabled in Azure IoT Device Workbench extension in VS Code to simplify the device cross-compiling toolchain acquisition effort for device developers working on embedded Linux devices (e.g. Debian, Ubuntu, Yocto Linux…) with Azure IoT by encapsulating the compilers, [device SDK](https://github.com/Azure/azure-iot-sdk-c) and essential libraries in [Containers](https://www.docker.com/resources/what-container). All you need is to install or upgrade the IoT Device Workbench and [get started](https://github.com/microsoft/vscode-iot-workbench#embedded-linux-public-preview) developing within the container, just like today you are using a local environment.

### Fixed

- Fix the issue of "MXCHIP AZ3166 serial port button not work" [#661](https://github.com/microsoft/vscode-iot-workbench/issues/661) which started after update to VS Code 1.36.0.

Special thanks to [br1pro](https://github.com/br1pro) and [Remco Ploeg](https://github.com/rploeg), thanks for your feedbacks.

## Version 0.2.9

- Release date: Jun. 21, 2019

### Added

- Provide the option to disable auto popup landing page.

### Fixed

- Improve the error handling of loading example.

## Version 0.2.8

- Release date: May 31, 2019

### Fixed

-Bug fixing.

## Version 0.2.7

- Release date: May 14, 2019

### Changed

- Performance improvement.

## Version 0.2.6

- Release date: Mar. 26th, 2019

### Fixed

- Bug fixing.

## Version 0.2.5

- Release date: Mar. 22nd, 2019

### Added

- Add dark theme for example gallery.
- Provide the document to describe the detailed steps of `Provision Azure Services`.
- IoT DevKit: Add new community contributed example of `Mxchip and Cloud Controlled Fan` into example gallery.
- IoT DevKit: Add new example of `IoT Devkit Dictionary` into example gallery.

### Changed

- Local web server has been replaced with VS Code webview.
- Improve the error handling when loading a new project.
- Performance improvement.

### Fixed

- Connection string longer than 200 can be configured correctly.
- Documentation issue fix.

## Version 0.2.4

- Release date: Feb. 15th, 2019

### Added

- IoT DevKit: Add new example of 'Air Traffic Control Simulator' into gallery.

### Changed

- Workbench path will be set automatically.

## Version 0.2.3

- Release date: Jan. 28th, 2019

### Added

- IoT DevKit: Add new example of 'Play GIFs on the MXCHIP' into gallery.

### Changed

- Remove 'Arduino Extension' from hard dependency list.

## Version 0.2.2

- Release date: Jan. 4th, 2019

### Added

- IoT DevKit: Add community contributed examples into gallery.

### Changed

- Remove 'Azure Functions Extension' from hard dependency list.
- IoT DevKit: Update the layout of the example gallery page.

## Version 0.2.1

- Release date: Dec. 24, 2018

### Changed

- Change to new logo.

## Version 0.2.0

- Release date: Dec. 14, 2018

### Added

- IoT DevKit: new sample of 'Connect to Microsoft IoT Central'.
- New option of 'My Device is not in the list...' in device selection.

### Fixed

- Rename **Azure IoT Workbench** to **Azure IoT Device Workbench**.
- Use C# library in Azure Functions for all MXChip IoT DevKit examples.
- Redesign commands for Azure IoT Device Workbench and update related documents.
- Redesign the Welcome page of the extension.

## Version 0.1.14

- Release date: Nov. 19, 2018

### Fixed

- Use C# library in Azure Functions for IoT DevKit examples.
- Refactor the flow of creating a new project.
- Fix the device connection string setting problem in macOS.
- Upgrade to VS Code's webview API

## Version 0.1.13

- Release date: Nov. 9, 2018

### Fixed

- Fix Azure Functions integration problem.

## Version 0.1.12

- Release date: October 16, 2018

### Added

- Add C# library support for Azure Functions.

### Fixed

- Improve folder selection experience when creating new project.

## Version 0.1.11

- Release date: September 26, 2018

### Fixed

- Fix Azure Functions breaking change.

## Version 0.1.10

- Release date: September 12, 2018

### Added

- Add generate CRC command for OTA.
- Add ESP32 examples.
- Add welcome page.

## Version 0.1.9

- Release date: August 13, 2018

### Added

- Add ESP32 into supported IoT hardware list.
- Add UDS configuration support for IoT DevKit.
- Add new template for Azure Steam Analytics and Cosmos DB.

### Fixed

- Replace tag parser for intellisense setting.

## Version 0.1.8

- Release date: August 1, 2018

### Fixed

- Update the node module dependency.

## Version 0.1.7

- Release date: July 12, 2018

### Fixed

- Hot fix for VS Code 1.25.0 breaking change.

## Version 0.1.6

- Release date: July 12, 2018

### Added

- Add Raspberry Pi into supported IoT hardware list.

## Version 0.1.2

- Release date: May 14, 2018

### Added

- Add teXXmo IoT button into supported IoT hardware list.

## Version 0.1.1

- Release date: May 10, 2018

### Added

- Create new IoT Device Workbench projects.
- Load existing examples of IoT Device Workbench project.
- Compile and upload device code.
- Config device settings.
