# Stream Analytics and Cosmos DB

In this tutorial, you will learn how to send data to Stream Analytics Job and export it to Cosmos DB with Azure Stream Analytics Query Langauge.

## What you need

Finish the [Getting Started Guide](./devkit-get-started.md) to:

- Have your DevKit connected to Wi-Fi.
- Prepare the development environment.

An active Azure subscription. If you do not have one, you can register via one of these two methods:

- Activate a [free 30-day trial Microsoft Azure account](https://azure.microsoft.com/free/).
- Claim your [Azure credit](https://azure.microsoft.com/pricing/member-offers/msdn-benefits-details/) if you are MSDN or Visual Studio subscriber.

## Create a New Project

Use `F1` or `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) to open the command palette, type **IoT Workbench**, and then select **IoT Workbench: New**.

![IoT Workbench: New](media/iot-workbench-new-cmd.png)

Select **With Stream Analytics and Cosmos DB**.

![IoT Workbench: New -> With Stream Analytics and Cosmos DB](media/iot-workbench-stream-analytics-and-cosmos-db.png)

A new project will be opened in a new window with two folders named Device and StreamAnalytics.

![With Stream Analytics and Cosmos DB Project Folder](media/iot-workbench-stream-analytics-and-cosmos-db-project-files.png)

## Provision Azure Service

Use `F1` or `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) to open the command palette, type **IoT Workbench**, and then select **IoT Workbench: Cloud**, **Azure Provision**.

![Azure Provision](media/iot-workbench-cloud-provision2.png)

Select subscription and resource group you want to create Azure services in. A guide line show what service will be created.

![Azure Provision Step](media/iot-workbench-stream-analytics-and-cosmos-db-provision-step.png)

Follow the guide to create Azure services.

> Notice: Currently, you need specific subscription and resource group for IoT Hub individually.

## Deploy Azure Stream Analytics Job Query

You can change Azure Stream Analytics Job Query by editing `StreamAnalytics/query.asaql`. ASAQL (Azure Stream Analytics Query Language) is SQL-like, you can learn more about it from <https://go.microsoft.com/fwLink/?LinkID=619153>.

![Azure Stream Analytics Query](media/iot-workbench-stream-analytics-and-cosmos-db-query.png)

Output and input have already been generated automatically by default (in the example above, the output is `cosmosdb-a94a5672-867c-6b4e-db41-872d6e01e4bf`, and input is `iothub-ff8feba1-b114-48de-d8c4-d25e7efa4864`). And you have no need to change them. `*` here is the same as SQL, means data in all feilds.

You can select specific feild data from input and export it into output. For example, your device sends data in such JSON format to IoT Hub:

```json
{
    "temperature": 42
}
```

You can write query as below:

```sql
SELECT
    temperature
FROM
    "iothub-ff8feba1-b114-48de-d8c4-d25e7efa4864"
INTO
    "cosmosdb-a94a5672-867c-6b4e-db41-872d6e01e4bf"
```

Deploy the query by executing **IoT Workbench: Cloud** command and select **Azure Deploy**.

![Azure Deply](media/iot-workbench-cloud-deploy.png)

IoT Workbench will stop Stream Analytics Job, update query and restart Stream Analytics Job automatically.

![Azure Deply Query](media/iot-workbench-stream-analytics-and-cosmos-db-deploy-query.png)

## Build and Upload the Device Code

1. Open the command palette and select **IoT Workbench: Device**, then select **Device Upload**.

   ![IoT Workbench: Device -> Upload](media/iot-workbench-device-upload.png)

2. VS Code then starts verifying and uploading the code to your DevKit.

   ![IoT Workbench: Device -> Uploaded](media/iot-workbench-stream-analytics-and-cosmos-db-upload.png)

3. The IoT DevKit reboots and starts running the code.

## Explore Data in Cosmos DB

You can use [Data Explorer](http://aka.ms/docdb-data-explorer) to explore Data in Cosmos DB.