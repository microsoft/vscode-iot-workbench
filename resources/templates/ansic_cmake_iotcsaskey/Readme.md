# Use generated code in your device project

One of the features VS Code Digital Twin tooling provides is generating stub code based on Device Capability Model (DCM) you specified.

Follow the steps to use the generated code with the Azure IoT Device C SDK source to compile a device app.

For more details about setting up development environment for compiling the C Device SDK. Check the [instructions](https://github.com/Azure/azure-iot-sdk-c/blob/master/iothub_client/readme.md#compiling-the-c-device-sdk) for each platform.

## Windows

1. Install [Visual Studio 2017](https://www.visualstudio.com/downloads/). You can use the Visual Studio Community Free download if you meet the licensing requirements. (Visual Studio 2015 is also supported.)

    > Be sure to include Visual C++ and NuGet Package Manager.

1. Install [git](http://www.git-scm.com/). Confirm git is in your PATH by typing `git version` from a command prompt.

1. Install [CMake](https://cmake.org/). Make sure it is in your PATH by typing `cmake -version` from a command prompt. CMake will be used to create Visual Studio projects to build libraries and samples.

1. Clone the preview release of SDK to your local machine using the tag name `public-preview-utopia`
    ```bash
    git clone https://github.com/Azure/azure-iot-sdk-c-pnp --recursive -b public-preview-utopia
    ```
    > The `--recursive` argument instructs git to clone other GitHub repos this SDK depends on. Dependencies are listed [here](https://github.com/Azure/azure-iot-sdk-c/blob/master/.gitmodules).

1. Copy the folder of **{PROJECT_NAME}** with the generated code into the source folder **azure-iot-sdk-c-pnp** .

1. In order to connect to IoT Central:
    * You need to have provisioned a private preview IoT Central instance. See [here](https://github.com/Azure/Azure-IoT-PnP-Preview/blob/master/docs/tutorial.md) for more end-to-end setup instructions.
    * Open `main.c`. Specify paramaters requested by the commented **TODO's** for your configuration.

      ```c
      // TODO: Specify DPS scope ID if you intend on using IoT Central.
      static const char* dpsIdScope = "[DPS Id Scope]";

      // TODO: Specify symmetric keys if you intend on using IoT Central and symmetric key based auth.
      static const char* sasKey = "[DPS symmetric key]";

      // TODO: specify your device registration ID
      static const char* registrationId = "[registration Id]";

      // TODO: Fill in DIGITALTWIN_DEVICE_CAPABILITY_MODEL_URI and DIGITALTWIN_MODEL_REPOSITORY_URI if you indend on using IoT Central.
      #define DIGITALTWIN_DEVICE_CAPABILITY_MODEL_URI "[your capabilityModel Id]"
      ```

1. Open the `CMakeLists.txt` in the **azure-iot-sdk-c-pnp** folder. Include the **{PROJECT_NAME}** folder so that it will be built together with the Device SDK. Add the line below to the end of the file.
    ```txt
    add_subdirectory({PROJECT_NAME})
    ```

1. In the same **azure-iot-sdk-c-pnp** folder, create a folder to contain the compiled app.
    ```bash
    mkdir cmake
    cd cmake
    ```

1. In the **cmake** folder just created, run CMake to build the entire folder of Device SDK including the generated code.
    ```bash
    cmake .. -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON -Dskip_samples:BOOL=ON
    cmake --build . -- /m /p:Configuration=Release
    ```

1. Once the build success, you can test it by invoking the following command.
    ```bash
    ..\\{PROJECT_NAME}\\Release\\{PROJECT_NAME}.exe
    ```

## Ubuntu

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

1. Clone the preview release of SDK to your local machine using the tag name `public-preview-utopia`
    ```bash
    git clone https://github.com/Azure/azure-iot-sdk-c-pnp --recursive -b public-preview-utopia
    ```
    > The `--recursive` argument instructs git to clone other GitHub repos this SDK depends on. Dependencies are listed [here](https://github.com/Azure/azure-iot-sdk-c/blob/master/.gitmodules).

1. Copy the folder of **{PROJECT_NAME}** with the generated code into the source folder **azure-iot-sdk-c-pnp** .

1. In order to connect to IoT Central:
    * You need to have provisioned a private preview IoT Central instance. See [here](https://github.com/Azure/Azure-IoT-PnP-Preview/blob/master/docs/tutorial.md) for more end-to-end setup instructions.
    * Open `main.c`. Specify paramaters requested by the commented **TODO's** for your configuration.

      ```c
      // TODO: Specify DPS scope ID if you intend on using DPS / IoT Central.
      static const char *dpsIdScope = "[DPS Id Scope]";
      
      // TODO: Specify symmetric keys if you intend on using DPS / IoT Central and symmetric key based auth.
      static const char *sasKey = "[DPS symmetric key]";
      
      // TODO: specify your device registration ID
      static const char *registrationId = "[device registration Id]";
      
      // TODO: Fill in DIGITALTWIN_DEVICE_CAPABILITY_MODEL_ID and DIGITALTWIN_DEVICE_CAPABILITY_MODEL_INLINE_DATA if you indend on using IoT Central.
      #define DIGITALTWIN_DEVICE_CAPABILITY_MODEL_ID "[your capabilityModel Id]"
      ```

1. Open the `CMakeLists.txt` in the **azure-iot-sdk-c-pnp** folder. Include the **{PROJECT_NAME}** folder so that it will be built together with the Device SDK. Add the line below to the end of the file.
    ```txt
    add_subdirectory({PROJECT_NAME})
    ```

1. In the same **azure-iot-sdk-c-pnp** folder, create a folder to contain the compiled app.
    ```bash
    mkdir cmake
    cd cmake
    ```

1. In the **cmake** folder just created, run CMake to build the entire folder of Device SDK including the generated code.
    ```bash
    cmake .. -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON -Dskip_samples:BOOL=ON
    cmake --build .
    ```

1. Once the build success, you can test it by invoking the following command.
    ```bash
    ./{PROJECT_NAME}/{PROJECT_NAME}
    ```