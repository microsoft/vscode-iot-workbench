# Find more details about base image in https://github.com/microsoft/vscode-iot-workbench/tree/master/devicedevex_dockerfiles/public
FROM mcr.microsoft.com/iot-device-cube:1.0.3-azure-c-sdk-public-preview-ubuntu-x86

# Install external libs
COPY install_packages.sh /work
RUN chmod +x /work/install_packages.sh && /work/install_packages.sh