**## Version 0.10.10-rc**

\- Release date: August 1, 2019

**### Fixed**

\- Support the new model repository connection string.

\- Fix the command request payload format issue that aligned with IoT platform and Central.

\- Change the codegen flow: throw error if the company repository hasn't be set and interface can't be found in local folder and public repository, user need run ***\*IoT Plug and Play: Open Model Repository\**** command to connect to company repository then re-run the code generation command.

\- Fix the search function in Model Repository UI.

\- Change the naming 'Organization Reposition' to 'Company Repository'.

\- Invalid model repository connection string will not be saved.

\- The 'contents' property in Interface support both array and single value.

\- Fix the async command response payload issue of missing quotation marks on string value.

\- Add the input Interface / DCM name into the generated .json schema file.

\- Print out the name of unsupported complex object in the VS Code output window.

\- Ignore ***\*DigitalTwin\****, ***\*ModelInformation\**** and ***\*SDKInformation\**** these 3 default interfaces when generating device code.

\- Fix wording and typos.

**### Added**

\- Save the model repository connection string in VS Code security store instead of global settings.

\- Auto-fill in the DCM id in the generated DPS code.

\- Add the default ModelDefinition Interface into the generated .json schema file.

\- Replace the 'Interface.json' and 'CapabilityModel.json' with 'IoTModel.json' for '@context' property in the generated .json schema file.

**## Version 0.10.9**

\- Release date: July 25, 2019

**### Fixed**

\- User can submit interface/capabilityModel with a generic json file name (ending with **.json**).

  ***\*NOTE\****: We don't force interface/capabilityModel file name suffix to be **interface.json** / **capabilityModel.json** in submit operation, but the DTDL IntelliSense will not work if the model file nane is not ended with **interface.json** / **capabilityModel.json**.

\- Fix issues that IntelliSense doesn't work for Enum/Unit/Schemas authoring.

\- Fix naming conflict issue for InterfaceInstance in capabilityModel/implements.

**### Added**

\- Support generating PnP device code from DCM which is exported from IoT Central.

\- Support generating PnP device code for datetime/date/time/duration schema.

\- Adjust commamd payload processing to align with cloud side contract.

\- Codegen doesn't overwrite user source file (e.g. main.c, device_impl.c) when re-generate PnP device Code.

\- Refresh language server to support language features in [latest DTDL](http://aka.ms/dtdl):

  \- Support unified context file (IoTModel.json) to align with IoT Central Model definition.

  \- Support IntelliSense for localizable properties (e.g. comment, displayName, description).

**## Version 0.10.8**

\- Release date: July 18, 2019

**### Fixed**

\- Improved the experience for generating code from Plug & Play model files.