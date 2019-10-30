# Embedded Linux Setup

If you are developing on embedded Linux for [ARM Cortex-A series](https://developer.arm.com/ip-products/processors/cortex-a) devices, you need to install and configure Docker in order to use a container as a compiling environment. [VS Code Remote](https://aka.ms/vscode-remote) is the technology that enables this experience.

## System Requirements

- Windows: Docker Desktop 2.0+ on Windows 10 Pro/Enterprise. (Docker Toolbox is not supported.) 
- macOS: Docker Desktop 2.0+. 
- Linux: Docker CE/EE 18.06+ and Docker Compose 1.21+. (The Ubuntu snap package is not supported.)

## Install Docker

Install and configure Docker for your operating system

### Windows / macOS

1. Install Docker Desktop for [Windows](https://docs.docker.com/docker-for-windows/install/) / [macOS](https://docs.docker.com/docker-for-mac/install/).

1. Right-click on the Docker taskbar item and update **Settings / Preferences > Shared Drives / File Sharing** to enable C drives in a container. If you run into trouble, see Docker Desktop for Windows tips on avoiding common problems with sharing.

  <img src="https://raw.githubusercontent.com/microsoft/vscode-iot-workbench/master/docs/images/shared-drivers.png" />

### Linux

1. Follow the official install instructions for Docker CE/EE for your distribution. If you are using Docker Compose, follow the Docker Compose directions as well. 

1. Add your user to the docker group by using a terminal to run:
  ```bash
  sudo usermod -aG docker $USER 
  ```

1. Sign out and back in again so your changes take effect. 

1. Check if Docker on your Linux use proper DNS. If output looks like below, there is a problem resolving DNS. Check FAQ: [Docker Setup on Linux](#) to fix the problem first. 
  ```bash
  $ docker run busybox nslookup google.com 
  
  Server:    8.8.8.8 
  Address 1: 8.8.8.8 
  nslookup: can't resolve 'google.com' 
  ```
