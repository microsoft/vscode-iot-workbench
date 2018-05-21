# Get Started with teXXmo IoT button in IoT Workbench
---

# Table of Contents

-   [Introduction](#Introduction)
-   [Step 1: Prerequisites](#Step-1-Prerequisites)
-   [Step 2: Create IoT Project](#Step-2-CreateIoTProject)
-   [Step 3: Provision Azure Services](#Step-3-AzureProvision)
-   [Step 4: Configure the setting on IoT button](#Step-4-ConfigDevice)
-   [Step 5: Deploy Azure Services](#Step-5-AzureDeploy)

<a name="Introduction"></a>
# Introduction

**About this document**

This document describes the steps for developing an IoT project for [teXXmo IoT button](https://aka.ms/button) in Azure IoT Workbench. This multi-step process includes:
-   Create an IoT project.
-   Provision and deploy Azure resources.
-   Configure device settings and run the sample.

<a name="Step-1-Prerequisites"></a>
# Step 1: Prerequisites

You need to make sure the following steps are finished before beginning the process:

* Required hardware: [teXXmo IoT button](https://aka.ms/button).
* [Visual Studio Code](https://code.visualstudio.com/download/) with [Azure IoT Workbench](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.vscode-iot-workbench) installed.
* [An Azure Subscription](https://azure.microsoft.com/en-us/free/) (free trial works great)

<a name="Step-2-CreateIoTProject"></a>
# Step 2: Create IoT Project

1. Open Visual Studio Code and open an empty folder.
1. Press **F1** or **Ctrl + Shift + P** in Visual Studio Code and select **IoT Workbench:New**.
1. Select the device of **IoT button teXXmo - Microsoft Azure Developer Kit**.
![CreateProject](Images/iot_button_create.jpg)
1. From the project template, please select **With Azure Functions**. With this template, when teXXmo IoT button is clicked, a telemetry will be sent to IoT Hub and Azure Functions will be triggered to execute the code.
![SelectTemplage](Images/iot_button_template.jpg)
1. After reload, the IoT project will be created in the target folder. 

<a name="Step-3-AzureProvision"></a>
# Step 3: Provision Azure Services

1. Press **F1** or **Ctrl + Shift + P** in Visual Studio Code - **IoT Workbench:Cloud** and click **Azure Provision**
1. You need to login with your Azure subscrption if you didn't do that before.
1. A popup window will open and guide you to provision the required Azure services. The whole process includes:
![provision](Images/iot_button_azure_provision.JPG)
    * Select an existing IoT Hub or create a new IoT Hub.
    * Select an existing IoT Hub device or create a new IoT Hub device. 
    * Create a new Function App.


<a name="#Step-4-ConfigDevice"></a>
# Step 4: Configure the setting on IoT button


1. Hold power button for 5 sec. LED changes from Green Flash to Yellow, then Red flash.When LED flashes in RED, the device is in AP Mode.

1. From any desktop machine, connect to the device via WiFi using the SSID : ESP_<Last 3 digits of MAC Address>.

1. In Visual Studio Code, press **F1** or **Ctrl + Shift + P** in Visual Studio Code - **IoT Workbench:Device** and click **Configure Device Settings**
![ConfigDevice](Images/iot_button_config_device.JPG)
    For teXXmo IoT button, the following commands are provided:

    | Command | Description |
    | --- | --- |
    | `Config WiFi of IoT button`  | Set WiFi SSID and password. |
    | `Config connection of IoT Hub Device` | Set the device connection string into IoT button. |
    | `Config time server of IoT button` | Config time server of IoT button. |
    | `Config JSON data to append to message`  | Append JSON data from `Device\userdata.json` into the message.  |
    | `Shutdown IoT button` | Shutdown IoT button. |

    Please click `Config WiFi of IoT button` and `Config connection of IoT Hub Device` and follow the guide to set the WiFi and device connection string of teXXmo IoT button and then click `Shutdown IoT button`

<a name="#Step-5-AzureDeploy"></a>
# Step 5: Deploy Azure Services

## Creating the Azure Logic App

1. Open the [Azure Portal](https://portal.azure.com)
1. Select the **+** or **Create a resource** button and under **Enterprise Integration** choose **Logic App**
1. Give it a Name, Resource Group, and Region (any will do) and click **Create**
1. After the logic app is created, open it
1. The designer should automatically load - if not click the **Edit** button
1. Select the **When an HTTP request is received** trigger
1. Click **New Step** to add a step to the workflow and **Add an action**
1. Search for or select the **Twitter** connector
    > NOTE: You are more than welcome to use any action you want to perform on an IoT event
1. Select the **Post a tweet** action and authenticate this logic app against a valid Twitter account.
1. Provide some text to be posted. For example: `I just built something awesome with Azure IoT! Try it yourself here: http://aka.ms/azureiotdemo`
1. Click the **Save** button to save this serverless workflow
1. Click the **When a HTTP request is received** card to open and reveal the URL generated after saving.  Copy that URL.
![logicApp](Images/iot_button_logicapp.JPG)

## Deploy Azure Functions

1. In Visual Studio Code, open the `run.csx` file (default named `Functions\IoTHubTrigger1\run.csx`) to edit the code for your function.
1. Edit the code with the following lines
    ```csharp
    using System;
    using System.Text;

    static HttpClient client = new HttpClient();
    public static void Run(string myIoTHubMessage, TraceWriter log)
    {
        log.Info($"C# IoT Hub trigger function processed a message: {myIoTHubMessage}");
        var httpContent = new StringContent(myIoTHubMessage, Encoding.UTF8, "application/json");
        client.PostAsync("https://prod-07..yourLogicAppURL..", httpContent);
    }
      
    ```
    > NOTE: replace the URL with the unique URL of your workflow
1. Press **F1** or **Ctrl + Shift + P** in Visual Studio Code - **IoT Workbench:Cloud** and click **Azure Deploy**. This command will deploy the function code to Azure Functions App.

## Testing the deployment

After clicking teXXmo IoT button, you will see the following tweets in your tweeter account.
![showTwitter](Images/iot_button_twitter.JPG)
