# devicedevex.azurecr.io/public/iot-device-cube:1.0.0-azure-c-sdk-20190705-cross-toolchain-arm32
# Usage example:
# docker build -t devicedevex.azurecr.io/public/iot-device-cube:1.0.0-azure-c-sdk-20190705-cross-toolchain-arm32 . --build-arg base_image_tag=1.0.0-ubuntu-cross-toolchain-arm32
ARG base_image_tag=1.0.0-ubuntu-cross-toolchain-arm32
FROM devicedevex.azurecr.io/internal/iot-device-cube:${base_image_tag}

ARG lib_openssl_uri=https://www.openssl.org/source/openssl-1.1.1c.tar.gz
ARG lib_openssl_name=openssl-1.1.1c
ARG lib_curl_uri=http://curl.haxx.se/download/curl-7.65.1.tar.gz
ARG lib_curl_name=curl-7.65.1
ARG lib_util_uri=https://mirrors.edge.kernel.org/pub/linux/utils/util-linux/v2.32/util-linux-2.32.1.tar.gz
ARG lib_util_name=util-linux-2.32.1
ARG c_sdk_version=2019-04-11

# CMake config for Azure C SDK
COPY Toolchain.cmake ${CROSS_ROOT}/
ENV CMAKE_TOOLCHAIN_FILE ${CROSS_ROOT}/Toolchain.cmake

RUN mkdir -p /usr/work
WORKDIR /usr/work

# Build openssl, curl, Linux utils and build Azure IoT C SDK
RUN apt-get update && \
    apt-get install -y --no-install-recommends wget ca-certificates xz-utils cmake make git nano && \
    wget ${lib_openssl_uri} && \
    tar -xvf ${lib_openssl_name}.tar.gz && \
    cd ${lib_openssl_name} && \
    ./Configure linux-generic32 shared --prefix=${LIBC_PREFIX}/usr --openssldir=${LIBC_PREFIX}/usr && \
    make && \
    make install && \
    cd .. && \
    wget ${lib_curl_uri} && \
    tar -xvf ${lib_curl_name}.tar.gz && \
    cd ${lib_curl_name} && \
    ./configure --with-sysroot=${LIBC_PREFIX} --prefix=${LIBC_PREFIX}/usr --target=${CROSS_TRIPLE} --with-ssl --with-zlib --host=${CROSS_TRIPLE} --build=x86_64-pc-linux-uclibc && \
    make && \
    make install && \
    cd .. && \
    wget ${lib_util_uri} && \
    tar -xvf ${lib_util_name}.tar.gz && \
    cd ${lib_util_name} && \
    ./configure --prefix=${LIBC_PREFIX}/usr --with-sysroot=${LIBC_PREFIX} --target=${CROSS_TRIPLE} --host=${CROSS_TRIPLE} --disable-all-programs  --disable-bash-completion --enable-libuuid && \
    make && \
    make install && \
    cd .. && \
    git clone https://github.com/azure/azure-iot-sdk-c.git -b ${c_sdk_version} --recursive && \
    cd azure-iot-sdk-c && \
    mkdir cmake && \
    cd cmake && \
    cmake -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE} -DCMAKE_INSTALL_PREFIX=${LIBC_PREFIX}/usr -Dhsm_type_symm_key:BOOL=ON -Duse_amqp:BOOL=OFF -Dbuild_service_client:BOOL=OFF -Dbuild_provisioning_service_client:BOOL=OFF -Dskip_samples:BOOL=ON .. && \
    make && \
    rm -rf /usr/work/* && \
    apt-get remove -y wget ca-certificates xz-utils git && \
    apt-get clean  && \
    rm -rf /var/lib/apt/lists/*
