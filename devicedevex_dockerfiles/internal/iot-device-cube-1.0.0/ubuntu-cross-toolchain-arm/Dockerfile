# devicedevex.azurecr.io/internal/iot-device-cube:1.0.0-ubuntu-cross-toolchain-arm32
# devicedevex.azurecr.io/internal/iot-device-cube:1.0.0-ubuntu-cross-toolchain-arm64
# Usage example:
# docker build -t devicedevex.azurecr.io/internal/iot-device-cube:1.0.0-ubuntu-cross-toolchain-arm32 .
FROM ubuntu:18.04
ARG linaro_package_uri=https://releases.linaro.org/components/toolchain/binaries/latest-7/arm-linux-gnueabihf/gcc-linaro-7.4.1-2019.02-x86_64_arm-linux-gnueabihf.tar.xz
ARG linaro_package_name=gcc-linaro-7.4.1-2019.02-x86_64_arm-linux-gnueabihf
ARG target_cross_triple=arm-linux-gnueabihf

RUN mkdir -p /usr/xcc
WORKDIR /usr/xcc

RUN apt-get update && \
    apt-get install -y --no-install-recommends wget ca-certificates xz-utils

# Prepare Linaro toolchain
RUN wget ${linaro_package_uri} && \
    tar -xf ${linaro_package_name}.tar.xz && \
    mv ${linaro_package_name} ${target_cross_triple} && \
    rm ${linaro_package_name}.tar.xz

# Set ENV
ENV CROSS_TRIPLE=${target_cross_triple}
ENV XCC_PREFIX=/usr/xcc

ENV CROSS_ROOT=${XCC_PREFIX}/${CROSS_TRIPLE}
ENV LIBC_PREFIX="${CROSS_ROOT}/${CROSS_TRIPLE}/libc"

ENV AS=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-as
ENV AR=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-ar
ENV CC=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-gcc
ENV CPP=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-cpp
ENV CXX=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-g++
ENV LD=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-ld
ENV FC=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-gfortran
ENV NM=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-nm
    
ENV RANLIB=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-ranlib
ENV LDFLAGS="-L${LIBC_PREFIX}/usr/lib"
ENV LIBS="-lssl -lcrypto -ldl -lpthread"

# Cleanups
RUN apt-get remove -y wget ca-certificates xz-utils && \
    apt-get clean  && \
    rm -rf /var/lib/apt/lists/*