# Use generated code in your device project

One of the features VS Code Digital Twin tooling provides is generating stub code based on the Device Capability Model (DCM) you specified.

Follow the steps to use the generated code with the Azure IoT Device C SDK source to compile a device app.

For more details about setting up your development environment for compiling the C Device SDK. Check the [instructions](https://github.com/Azure/azure-iot-sdk-c/blob/master/iothub_client/readme.md#compiling-the-c-device-sdk) for each platform.

## Windows

1. Install [Visual Studio](https://www.visualstudio.com/downloads/). You can use the Visual Studio Community Free download if you meet the licensing requirements. (Visual Studio 2015 is also supported.)

    > Be sure to include **Desktop development with C++** and **NuGet Package Manager** from the Visual Studio Installer.

1. Install [git](http://www.git-scm.com/). Confirm git is in your PATH by typing `git version` from a command prompt.

1. Install [CMake](https://cmake.org/). Make sure it is in your PATH by typing `cmake -version` from a command prompt. CMake will be used to create Visual Studio projects to build libraries and samples.

1. Clone the preview release of the SDK to your local machine using the `public-preview` branch
    ```bash
    git clone https://github.com/Azure/azure-iot-sdk-c --recursive -b public-preview
    ```
    > The `--recursive` argument instructs git to clone other GitHub repos this SDK depends on. Dependencies are listed [here](https://github.com/Azure/azure-iot-sdk-c/blob/master/.gitmodules).

1. Copy the folder of **{PROJECT_NAME}** with the generated code into the source folder **azure-iot-sdk-c-pnp** .

1. Open the `CMakeLists.txt` in the **azure-iot-sdk-c-pnp** folder. Include the **{PROJECT_NAME}** folder so that it will be built together with the Device SDK. Add the line below to the end of the file.
    ```txt
    add_subdirectory({PROJECT_NAME})
    ```

1. In the same **azure-iot-sdk-c-pnp** folder, create a folder to contain the compiled app.
    ```bash
    mkdir cmake
    cd cmake
    ```

1. In the **cmake** folder you just created, run CMake to build the entire folder of Device SDK including the generated app code.
    ```bash
    cmake .. -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON
    ```

1. Open the `..\cmake\azure_iot_sdks.sln` in Visual Studio 2017 and build the solution.

1. Once the build has successed, you can test it by specifying the IoT Hub device connection string as its parameter.
    ```bash
    \\{PROJECT_NAME}\\Release\\{PROJECT_NAME}.exe "[IoTHub device connection string]"
    ```


