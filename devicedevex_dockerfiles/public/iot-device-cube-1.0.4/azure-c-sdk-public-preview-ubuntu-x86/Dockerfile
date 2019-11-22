# devicedevex.azurecr.io/public/iot-device-cube:1.0.4-azure-c-sdk-public-preview-ubuntu-x86
FROM ubuntu:18.04

WORKDIR /work

RUN apt-get update && \
    apt-get install -y git cmake build-essential libcurl4-openssl-dev libssl-dev uuid-dev curl unzip tar && \
    git clone https://github.com/microsoft/vcpkg && \
    cd vcpkg && \
    ./bootstrap-vcpkg.sh && \
    ./vcpkg install azure-iot-sdk-c[public-preview,use_prov_client] && \
    apt-get remove -y git unzip && \
    apt-get clean  && \
    rm -rf /var/lib/apt/lists/*