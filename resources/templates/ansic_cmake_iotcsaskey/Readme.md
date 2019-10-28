# Use generated code in your device project

One of the features VS Code Digital Twin tooling provides is generating stub code based on the Device Capability Model (DCM) you specified.

Follow the steps to use the generated code with the Azure IoT Device C SDK source to compile a device app.

For more details about setting up your development environment for compiling the C Device SDK. Check the [instructions](https://github.com/Azure/azure-iot-sdk-c/blob/master/iothub_client/readme.md#compiling-the-c-device-sdk) for each platform.

## Windows

### Prerequisite
1. Install [Visual Studio](https://www.visualstudio.com/downloads/). You can use the Visual Studio Community Free download if you meet the licensing requirements. (Visual Studio 2015 is also supported.)

    > Be sure to include **Desktop development with C++** and **NuGet Package Manager** from the Visual Studio Installer.

1. Install [git](http://www.git-scm.com/). Confirm git is in your PATH by typing `git version` from a command prompt.

1. Install [CMake](https://cmake.org/). Make sure it is in your PATH by typing `cmake -version` from a command prompt. CMake will be used to create Visual Studio projects to build libraries and samples.

1. In order to connect to IoT Central:
    * Complete the [Create an Azure IoT Central application (preview features)](https://docs.microsoft.com/en-us/azure/iot-central/quick-deploy-iot-central-pnp?toc=/azure/iot-central-pnp/toc.json&bc=/azure/iot-central-pnp/breadcrumb/toc.json) quickstart to create an IoT Central application using the Preview application template.

    * Retrieve DPS connection infomation from Azure IoT Central, including **DPS ID Scope**, **DPS Symmetric Key**, **Device ID**, which will be pass the as paramerters of the device app executable. Please refer to [this document](https://docs.microsoft.com/en-us/azure/iot-central/concepts-connectivity) for more details. Save them to the clipboard for later use.

### Build with Vcpkg of Azure IoT Device SDK
1. Run the following commands to set up Vcpkg package manager tool and install the `azure-iot-sdk-c` Vcpkg package.
    ```cmd
    git clone https://github.com/microsoft/vcpkg
    cd vcpkg
    .\bootstrap-vcpkg.sh
    .\vcpkg install azure-iot-sdk-c[public-preview,use_prov_client]
    ```

1. Go to the **root folder of your generated app**.
    ```cmd
    cd {PROJECT_NAME}
    ```

1. Create a folder for your CMake build.
    ```cmd
    mkdir cmake
    cd cmake
    ```

1. Run CMake to build your app with `azure-iot-sdk-c` source code. The best way to use installed libraries with cmake is via the toolchain file `scripts\buildsystems\vcpkg.cmake` from your vcpkg repo.
    ```cmd
    cmake .. -DCMAKE_TOOLCHAIN_FILE={Directory of your vcpkg repo}\scripts\buildsystems\vcpkg.cmake -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON
    cmake --build.
    ```

1. Once the build has succeeded, you can test it by specifying the DPS info (**DPS ID Scope**, **DPS Symmetric Key**, **Device Id**) as its parameter.
    ```cmd
    .\Debug\{PROJECT_NAME}.exe [DPS ID Scope] [DPS symmetric key] [device ID]
    ```

### Build with Source Code of Azure IoT Device SDK
1. Go to the **root folder of your generated app**.
    ```cmd
    cd {PROJECT_NAME}
    ```

1. git clone the preview release of the Azure IoT Device C SDK to your app folder using the `public-preview` branch.
    ```cmd
    git clone https://github.com/Azure/azure-iot-sdk-c --recursive -b public-preview
    ```
    > The `--recursive` argument instructs git to clone other GitHub repos this SDK depends on. Dependencies are listed [here](https://github.com/Azure/azure-iot-sdk-c/blob/master/.gitmodules).

    NOTE: Or you can copy the source code of Azure IoT Device C SDK to your app folder if you already have a local copy.

1. Create a folder for your CMake build.
    ```cmd
    mkdir cmake
    cd cmake
    ```

1. Run CMake to build your app with `azure-iot-sdk-c` source code.
    ```cmd
    cd cmake
    cmake .. -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON -Dskip_samples:BOOL=ON
    cmake --build .
    ```

1. Once the build has succeeded, you can test it by specifying the DPS info (**DPS ID Scope**, **DPS Symmetric Key**, **Device Id**) as its parameters.
    ```cmd
    .\Debug\{PROJECT_NAME}.exe [DPS ID Scope] [DPS symmetric key] [device ID]
    ```

## Ubuntu

### Prerequisite
1. Make sure all dependencies are installed before building the SDK. For Ubuntu, you can use apt-get to install the right packages.
    ```bash
    sudo apt-get update
    sudo apt-get install -y git cmake build-essential curl libcurl4-openssl-dev libssl-dev uuid-dev
    ```

1. Verify that **CMake** is at least version **2.8.12** and **gcc** is at least version **4.4.7**.
    ```bash
    cmake --version
    gcc --version
    ```

### Build with Vcpkg of Azure IoT Device SDK
1. Run the following commands to set up Vcpkg package manager tool and install the `azure-iot-sdk-c` Vcpkg package.
    ```bash
    git clone https://github.com/microsoft/vcpkg
    cd vcpkg
    ./bootstrap-vcpkg.sh
    ./vcpkg install azure-iot-sdk-c[public-preview,use_prov_client]
    ```

1. Go to the **root folder of your generated app**.
    ```bash
    cd {PROJECT_NAME}
    ```

1. Create a folder for your CMake build.
    ```bash
    mkdir cmake
    cd cmake
    ```

1. Run CMake to build your app with `azure-iot-sdk-c` source code. The best way to use installed libraries with cmake is via the toolchain file `scripts/buildsystems/vcpkg.cmake` from your vcpkg repo.
    ```bash
    cmake .. -DCMAKE_TOOLCHAIN_FILE={Directory of your vcpkg repo}/scripts/buildsystems/vcpkg.cmake -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON
    cmake --build.
    ```

1. Once the build has succeeded, you can test it by specifying the DPS info (**DPS ID Scope**, **DPS Symmetric Key**, **Device Id**) as its parameter.
    ```bash
    ./{PROJECT_NAME}/{PROJECT_NAME} [DPS ID Scope] [DPS symmetric key] [device ID]
    ```

### Build with Source Code of Azure IoT Device SDK
1. Go to the **root folder of your generated app**.
    ```bash
    cd {PROJECT_NAME}
    ```

1. git clone the preview release of the Azure IoT Device C SDK to your app folder using the `public-preview` branch.
    ```bash
    git clone https://github.com/Azure/azure-iot-sdk-c --recursive -b public-preview
    ```
    > The `--recursive` argument instructs git to clone other GitHub repos this SDK depends on. Dependencies are listed [here](https://github.com/Azure/azure-iot-sdk-c/blob/master/.gitmodules).

    NOTE: Or you can copy the source code of Azure IoT Device C SDK to your app folder if you already have a local copy.

1. Create a folder for your CMake build.
    ```bash
    mkdir cmake
    cd cmake
    ```

1. Run CMake to build your app with `azure-iot-sdk-c` source code.
    ```bash
    cd cmake
    cmake .. -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON -Dskip_samples:BOOL=ON
    cmake --build .
    ```

1. Once the build has succeeded, you can test it by specifying the DPS info (**DPS ID Scope**, **DPS Symmetric Key**, **Device Id**) as its parameter.
    ```bash
    ./{PROJECT_NAME} [DPS ID Scope] [DPS symmetric key] [device ID]
    ```
    