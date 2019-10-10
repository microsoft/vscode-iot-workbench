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

### Build Steps
In the root folder of your generated app:
1.  git clone the preview release of the Azure IoT C SDK to your app folder using the `public-preview` branch.
    ```bash
    git clone https://github.com/Azure/azure-iot-sdk-c --recursive -b public-preview
    ```
    > The `--recursive` argument instructs git to clone other GitHub repos this SDK depends on. Dependencies are listed [here](https://github.com/Azure/azure-iot-sdk-c/blob/master/.gitmodules).

1. In the same folder, create a folder to contain the compiled app.
    ```bash
    mkdir cmake
    cd cmake
    ```

1. Open the `CMakeLists.txt` in your app folder. Uncomment the following line to build with the source code of `azure-iot-sdk-c`.
    ```bash
    add_subdirectory(azure-iot-sdk-c)
    ```

1. Run CMake to build your app with `azure-iot-sdk-c`.
    ```bash
    cd cmake
    cmake .. -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON -Dskip_samples:BOOL=ON
    cmake --build . -- /m /p:Configuration=Release
    ```

1. Once the build has succeeded, you can test it by specifying the IoT Hub device connection string as its parameter.
    ```bash
    \\{PROJECT_NAME}\\Release\\{PROJECT_NAME}.exe "[IoTHub device connection string]"
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

### Build Steps
In the root folder of your generated app:
1.  git clone the preview release of the Azure IoT C SDK to your app folder using the `public-preview` branch.
    ```bash
    git clone https://github.com/Azure/azure-iot-sdk-c --recursive -b public-preview
    ```
    > The `--recursive` argument instructs git to clone other GitHub repos this SDK depends on. Dependencies are listed [here](https://github.com/Azure/azure-iot-sdk-c/blob/master/.gitmodules).

1. In the same folder, create a folder to contain the compiled app.
    ```bash
    mkdir cmake
    cd cmake
    ```

1. Open the `CMakeLists.txt` in your app folder. Uncomment the following line to build with the source code of `azure-iot-sdk-c`.
    ```bash
    add_subdirectory(azure-iot-sdk-c)
    ```

1. Run CMake to build your app with `azure-iot-sdk-c`.
    ```bash
    cd cmake
    cmake .. -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON -Dskip_samples:BOOL=ON
    cmake --build .
    ```

1. Once the build has succeeded, you can test it by specifying the IoT Hub device connection string as its parameter.
    ```bash
    ./{PROJECT_NAME}/{PROJECT_NAME} "[IoTHub device connection string]"
    ```