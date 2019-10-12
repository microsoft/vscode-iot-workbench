ARG base_image=ubuntu:18.04
FROM ${base_image}
ARG c_sdk_repo=github.com/Azure/azure-iot-sdk-c-pnp
ARG c_sdk_version=public-preview-utopia
ARG github_username=default-username
ARG github_token=default-token

RUN apt-get update && \
    apt-get install -y git cmake build-essential curl libcurl4-openssl-dev libssl-dev uuid-dev

RUN mkdir /work && \
    chown -R 1000:1000 /work

# setup new user builder so that we don't run it all as root
RUN groupadd -o -g $(stat -c "%g" /work) "builder" && \
    useradd -N -g $(stat -c "%g" /work) -m -o -u $(stat -c "%u" /work) -p builder "builder"
USER builder

WORKDIR /work
RUN git clone https://${github_username}:${github_token}@${c_sdk_repo} --recursive -b ${c_sdk_version} azure-iot-sdk-c
RUN cd azure-iot-sdk-c && \
    mkdir cmake && \
    cd cmake && \
    cmake -Dhsm_type_symm_key:BOOL=ON -Duse_amqp:BOOL=OFF -Dbuild_service_client:BOOL=OFF -Dbuild_provisioning_service_client:BOOL=OFF -Dskip_samples:BOOL=ON .. && \
    make