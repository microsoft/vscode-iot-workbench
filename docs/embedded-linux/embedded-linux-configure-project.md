# Configure an existing project using containerized toolchain

*[WIP]*

If you have an existing device project that uses CMake. You can easily convert it to use the containerized toolchain by following these steps:

1. Open the project folder which you want to convert in VS Code.

2. Run **Azure IoT Device Workbench: Configure Project for Device Development Environment...** from the Command Palette (<kbd>F1</kbd>).

3. Follow the steps to select the device platform for your project. Currently it supports **Arduino** and **Embedded Linux**. The **Embedded Linux** uses the containerized toolchain to encapsulate the GCC cross-compilers, CMake and Azure IoT device C SDK.

4. Select the archtype for your device. For example, if your device is NXP i.MX6, you may want to use the image for **ARMv7 Linux**.

5. Optionally, you can further customize the image to add your own device libraries and packages your device relies on. This will open the