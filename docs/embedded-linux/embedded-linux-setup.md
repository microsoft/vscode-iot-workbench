# Embedded Linux Setup

If you are developing on embedded Linux for [ARM Cortex-A series](https://developer.arm.com/ip-products/processors/cortex-a) devices, you need to install and configure Docker in order to use a container as a compiling environment. [VS Code Remote](https://aka.ms/vscode-remote) is the technology that enables this experience.

## Install Docker

- Install Docker Desktop for Windows

  Follow the [installation guide](https://docs.docker.com/docker-for-windows/install/) and make sure to enable driver sharing for Docker to access your local folder:

  1. Right click the **Docker** icon in the task tray and select "Settings".
  2. Click on the "Shared Drivers" section and choose the driver to be shared.

    <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/shared-drivers.png" />

- Install Docker Desktop for Mac

  Follow the [installation guide](https://docs.docker.com/docker-for-mac/install/) and make sure to enable driver sharing for Docker to access your local folder, which is enabled by default.

- Get Docker for Linux

  Linux is a highly variable environment and the large number of server, container, and desktop distributions can make it difficult to know what is supported. Check this [tutorial](https://code.visualstudio.com/docs/remote/linux) for Linux support.
