# devicedevex.azurecr.io/public/iot-device-cube:1.0.2-azure-c-sdk-public-preview-ubuntu-x86
ARG base_image=ubuntu:18.04
FROM ${base_image}
ARG c_sdk_branch=public-preview

RUN apt-get update && \
    apt-get install -y git cmake build-essential curl libcurl4-openssl-dev libssl-dev uuid-dev

RUN mkdir /work && \
    chown -R 1000:1000 /work

# setup new user builder so that we don't run it all as root
RUN groupadd -o -g $(stat -c "%g" /work) "builder" && \
    useradd -N -g $(stat -c "%g" /work) -m -o -u $(stat -c "%u" /work) -p builder "builder"
USER builder

WORKDIR /work
RUN git clone --single-branch --branch ${c_sdk_branch} --recursive https://github.com/azure/azure-iot-sdk-c.git && \
    cd azure-iot-sdk-c && \
    mkdir cmake && \
    cd cmake && \
    cmake -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE} -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON .. && \
    make