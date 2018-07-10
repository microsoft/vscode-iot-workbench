# Door Monitor          

The MXChip IoT DevKit contains a built-in magnetic sensor. In this tutorial, you detect the presence or absence of a nearby strong magnetic field--in this case, coming from a small. permanent magnet.

## What you learn

In this tutorial, you learn:
- How to use the MXChip IoT DevKit's magnetic sensor to detect the movement of a nearby magnet.
- How to use the SendGrid service to send a notification to your email address.

> NOTE: For a practical use of this project:
> - Mount a magnet to the edge of a door.
> - Mount the DevKit on the door jamb close to the magnet. Opening or closing the door will trigger the sensor, resulting in your receiving an email notification of the event.

## About IoT DevKit

The [MXChip IoT DevKit](https://aka.ms/iot-devkit) (a.k.a. IoT DevKit) is an all-in-one Arduino compatible board with rich peripherals and sensors. You can develop for it using [Azure IoT Workbench ](https://aka.ms/azure-iot-workbench). And it comes with a growing [projects catalog](https://aka.ms/devkit/project-catalog) to guide you prototype Internet of Things (IoT) solutions that take advantage of Microsoft Azure services.

## What you need

Finish the [Getting Started Guide](./devkit-get-started.md) to:

* Have your IoT DevKit connected to Wi-Fi.
* Prepare the development environment.

An active Azure subscription. If you do not have one, you can register via one of these methods:

* Activate a [free 30-day trial Microsoft Azure account](https://azure.microsoft.com/free/).
* Claim your [Azure credit](https://azure.microsoft.com/pricing/member-offers/msdn-benefits-details/) if you are an MSDN or Visual Studio subscriber.

## Open the project folder

### Start VS Code

* Start Visual Studio Code.
* Make sure [Azure IoT Workbench](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.vscode-iot-workbench) is installed.
* Connect IoT DevKit to your PC.

### Open IoT Workbench Examples

Use `F1` or `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) to open the command palette, type **IoT Workbench**, and then select **IoT Workbench: Examples**.

![IoT Workbench: Examples](media/iot-workbench-examples-cmd.png)

Select **IoT DevKit**.

![IoT Workbench: Examples -> Select board](media/iot-workbench-examples-board.png)

Then the **IoT Workbench Example** window is showed up.

![IoT Workbench, Examples window](media/iot-workbench-examples.png)

Find **Door Monitor** and click **Open Sample** button. A new VS Code window with a project folder in it opens.

![Open door monitor](media/devkit-door-monitor/open-sample.png)

## Deploy SendGrid service in Azure

[SendGrid](https://sendgrid.com/) is a cloud-based email delivery platform. This service will be used to send email notifications.

> NOTE: If you have already deployed a SendGrid service, you may proceed directly to [Deploy IoT Hub in Azure](#deploy-iot-hub-in-azure).

### SendGrid Deployment

To provision Azure services, use the **Deploy to Azure** button. This button enables quick and easy deployment of your open-source projects to Microsoft Azure.

Click the **Deploy to Azure** button, below. 

[![Deploy to Azure](http://azuredeploy.net/deploybutton.png)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2FIoTDevEnvExamples%2FDevKitDoorMonitor%2Fdeploy%2FSendGridDeploy%2Fazuredeploy.json)

You then see the following page.

![SendGrid Deployment](media/devkit-door-monitor/sendgrid-deploy.png)

> NOTE: If you do not see the above page, you may need to first sign in to your Azure account.

Complete the sign-up form:

  * **Resource group**: Create a resource group to host the SendGrid service, or use an existing one. See [Using resource groups to manage your Azure resources](https://docs.microsoft.com/azure/azure-resource-manager/resource-group-portal).

  * **Name**: The name for your SendGrid service. Choose a unique name, differing from other services you may have.

  * **Password**: The service requires a password, which will not be for anything in this project.

  * **Email**: The SendGrid service will send verification to this email address.

  > NOTE:Check the **Pin to dashboard** option to make this application easier to find in the future.

### SendGrid API Key creation

After the deployment succeeds, click it and then click the **Manage** button. You are taken to your SendGrid page, and need to verify your email address.

![SendGrid Manage](media/devkit-door-monitor/sendgrid-manage.png)

On the SendGrid page, click **Settings** > **API Keys** > **Create API Key**. Input the **API Key Name** and click **Create & View**.

![SendGrid Create API First](media/devkit-door-monitor/sendgrid-create-api-first.png)

![SendGrid Create API Second](media/devkit-door-monitor/sendgrid-create-api-second.png)

Your API key is displayed only one time. Be sure to copy and store it safely, as it is used in the next step.

## Creating Azure Logic App

1. Open [Azure Portal](https://portal.azure.com)
2. Select the **+** or **Create a resource** button and under **Enterprise Integration** choose **Logic App**.
3. Give it a Name, Resource Group, and Region (any will do) and click **Create**.
4. After the logic app is created, open it.
5. The designer should automatically load - if not click the **Edit** button.
6. Select the **When an HTTP request is received** trigger.
7. Click **New Step** to add a step to the workflow and **Add an action**.
8. Search for the key word of **Send email** action.
    > NOTE: You are more than welcome to use any action you want to perform on an IoT event

	![SendGrid action](media/devkit-door-monitor/logic-app-sendgrid.JPG)

9. Select the **SendGrid - Send email(V2)** action and provide the detailed information of the email. For **Email body**, please use the dynamic content of **Body**.
10. Authenticate this logic app by using the SendGrid API key you created before.

11. Click the **Save** button to save this serverless workflow.
12. Click the **When a HTTP request is received** card to open and reveal the URL generated after saving.  Copy that URL.

	![capture URL](media/devkit-door-monitor/capture-url.jpg)

## Provision Azure services

In the solution window, open the command palette and select **IoT Workbench: Cloud**.

![IoT Workbench: Cloud](media/iot-workbench-cloud.png)

Select **Azure Provision**.

![IoT Workbench: Cloud -> Provision](media/iot-workbench-cloud-provision.png)

Then VS Code guides you through provisioning the required Azure services.

![IoT Workbench: Cloud -> Provision steps](media/iot-workbench-cloud-provision-steps3.png)

The whole process includes:
* Select an existing IoT Hub or create a new IoT Hub.
* Select an existing IoT Hub device or create a new IoT Hub device. 
* Create a new Function App.

## Deploy Azure Functions

In Visual Studio Code, open the `run.csx` file (default named `Functions\doormonitor\run.csx`) to edit the code for your function.

Edit the code with the following lines

```csharp
client.PostAsync("https://prod-07..yourLogicAppURL..", httpContent);  
```

> NOTE: replace the URL with the unique URL of your workflow

Open the command palette and select **IoT Workbench: Cloud**, then select **Azure Deploy**.

![IoT Workbench: Cloud -> Deploy](media/iot-workbench-cloud-deploy.png)


## Config IoT Hub Connection String

1. Switch the IoT DevKit into **Configuration mode**. To do so:

   - Hold down button **A**.
   - Push and release the **Reset** button.

2. The screen displays the DevKit ID and 'Configuration'.

	![IoT DevKit Configuration Mode](media/devkit-configuration-mode.png) 

3. Open the command palette and select **IoT Workbench: Device**.

	![IoT Workbench: Device](media/iot-workbench-device.png)

4. Select **Config Device Settings**.

	![IoT Workbench: Device -> Settings](media/iot-workbench-device-settings.png)

5. Select **Select IoT Hub Device Connection String**.

	![IoT Workbench: Device -> Connection string](media/iot-workbench-device-string1.png)

   This sets the connection string that is retrieved from the `Provision Azure services` step.

6. The configuration success notification popup bottom right corner once it's done.

	![IoT DevKit Connection String OK](media/iot-workbench-connection-done.png) 

## Build and upload the device code

1. Open the command palette and select **IoT Workbench: Device**, then select **Device Upload**.

	![door monitor device upload](media/iot-workbench-device-upload.png)

2. VS Code then starts verifying and uploading the Arduino sketch to your DevKit:

	![door monitor compile](media/devkit-door-monitor/iot-workbench-device-uploaded.png)

3. The IoT DevKit reboots and starts running the code.

## Test the project

The program first initializes when the DevKit is in the presence of a stable magnetic field.

After initialization, `Door closed` is displayed on the screen. When there is a change in the magnetic field, the state changes to `Door opened`. Each time the door state changes, you receive an email notification. (These email messages may take up to five minutes to be received.)

![Magnets close to the sensor: Door Closed](media/devkit-door-monitor/test-door-closed.jpg "Magnets close to the sensor: Door Closed")

![Magnet moved away from the sensor: Door Opened](media/devkit-door-monitor/test-door-opened.jpg "Magnet moved away from the sensor: Door Opened")

## Problems and feedback

If you encounter problems, you can refer to [FAQs](https://microsoft.github.io/azure-iot-developer-kit/docs/faq/) or connect using the following channels:

* [Gitter.im](http://gitter.im/Microsoft/azure-iot-developer-kit)
* [Stackoverflow](https://stackoverflow.com/questions/tagged/iot-devkit)

## Next Steps

You have successfully used the MXChip IoT DevKit's magnetic sensor to detect the movement of a nearby magnet and leverage the SendGrid service to send a notification to your email address.
Check our [Projects Catalog](https://aka.ms/devkit/project-catalog) for more samples you can build with the IoT DevKit and Azure multiple services.
