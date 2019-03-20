# Provision Azure IoT Hub #

## Overview ##

When provisioning Azure Services in **Azure IoT Device Workbench**, the common provision process includes the provision of **Azure IoT Hub**. 

  ![provision process](pic/provision_process.png)

This document contains the detailed steps on how to provision Azure IoT Hub.

## Steps for Provision Azure IoT Hub ##

1. In the solution window, open the command palette and select **Azure IoT Device Workbench: Provision Azure Services...**.

	![IoT Device Workbench: Cloud -> Provision](pic/iot-workbench-cloud-provision.png)

1. If you haven't sign in to Azure in Visual Studio Code before, the following will be pop-up to guide you for Azure sign-in. 

	![azure sign in](pic/azure_signin.png)


1. Input your Azure Account Id and password and make sure you sign in successfully. 

	![sign_in successfully](pic/sign_in_success.png)

1. open the command palette in Visual Studio Code, type **Azure: Select Subscription** to select the subscription you want to use 

	![subscription](pic/subscription.png)

	Then re-run **Azure IoT Device Workbench: Provision Azure Services...**

1. In the dropdown list of **Select Resource Group**, 

	![resource group](pic/resource_group.png)

	- To use a new resource group, click **Create Resource Group** and then provide the following information:

		| Name | Value |
		| --- | --- |
		| Resource Group Name  | YOUR_RESOURCE_GROUP_NAME |
		| Resource Group Location | [Available Locations](https://azure.microsoft.com/en-us/global-infrastructure/locations/)|

	- If there are resource groups available, you could also select it directly from the dropdown list.  


1. After the resource group is selected, in the dropdown list of **Provision IoT Hub**, 

	![iothub](pic/iothub.png)

	- Click **Select an existing IoT Hub** if you want to use an existing IoT Hub, and select the IoT Hub you plan to use.

	- If you plan to create a new IoT Hub, click **Create a new IoT Hub**, first select the location with the same as the resource group.
		>  Azure resources can be connected across regions, but keeping everything within the same data center reduces cost and minimizes latency.

		Make sure **S1 - Standard tier** is selected as the pricing tier. Enter a unique name for IoT Hub name. IoT Hub names must be unique across Azure. 

		> Because you selected **S1 - Standard** as the pricing tier, you can transmit up to 400,000 messages a day to the IoT Hub for $50 per month. A **Free** tier that accepts up to 8,000 messages per day is also available. For more information on the various pricing tiers that are available, see [IoT Hub pricing](https://azure.microsoft.com/pricing/details/iot-hub/)

1. Wait until the IoT Hub has been provisioned. Then, in the dropdown list of **Provision IoTHub Device**, 

	![iothub_device](pic/iothub_device.png)

	- To create a new device, select **Create a new IoT Hub device**. Provide a device name and press 'Enter'.
	- To use a existing IoT Hub device, click **Select an existing IoT Hub device** and select the target device from the list.

	Wait until the IoT Hub device has been provisioned