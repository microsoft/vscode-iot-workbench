FROM mcr.microsoft.com/iot-device-cube:1.0.0-azure-c-sdk-20190411-ubuntu-arm64

RUN cp /work/azure-iot-sdk-c/CMakeLists.txt /work/azure-iot-sdk-c/default_CMakeLists.txt

# Install external libs
COPY install_packages.sh /work
RUN chmod +x /work/install_packages.sh && /work/install_packages.sh