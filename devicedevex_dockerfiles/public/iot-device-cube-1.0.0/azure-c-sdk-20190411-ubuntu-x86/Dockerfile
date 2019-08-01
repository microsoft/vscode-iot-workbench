ARG base_image=ubuntu:18.04
FROM ${base_image}
ARG c_sdk_version=2019-04-11

RUN apt-get update && \
    apt-get install -y git cmake build-essential curl libcurl4-openssl-dev libssl-dev uuid-dev

RUN mkdir /workdir && \
    chown -R 1000:1000 /workdir

# setup new user builder so that we don't run it all as root
RUN groupadd -o -g $(stat -c "%g" /workdir) "builder" && \
    useradd -N -g $(stat -c "%g" /workdir) -m -o -u $(stat -c "%u" /workdir) -p builder "builder"
USER builder

WORKDIR /workdir
RUN git clone https://github.com/azure/azure-iot-sdk-c.git -b ${c_sdk_version} --recursive
RUN cd azure-iot-sdk-c && \
    mkdir cmake && \
    cd cmake && \
    cmake -Dhsm_type_symm_key:BOOL=ON -Duse_amqp:BOOL=OFF -Dbuild_service_client:BOOL=OFF -Dbuild_provisioning_service_client:BOOL=OFF -Dskip_samples:BOOL=ON .. && \
    make