# Find more details about base image in https://github.com/microsoft/vscode-iot-workbench/tree/master/devicedevex_dockerfiles/public
FROM mcr.microsoft.com/iot-device-cube:1.0.2-azure-c-sdk-public-preview-ubuntu-x86

RUN cp /work/azure-iot-sdk-c/CMakeLists.txt /work/azure-iot-sdk-c/default_CMakeLists.txt

# Install external libs
COPY install_packages.sh /work
USER root
RUN chmod +x /work/install_packages.sh && /work/install_packages.sh

USER builder
