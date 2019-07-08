# devicedevex.azurecr.io/internal/iot-device-cube:1.0.0-alpine-arm64
FROM frolvlad/alpine-glibc

# Download toolchain
RUN mkdir -p /usr/xcc
WORKDIR /usr/xcc
RUN wget https://releases.linaro.org/components/toolchain/binaries/latest-7/aarch64-linux-gnu/gcc-linaro-7.4.1-2019.02-x86_64_aarch64-linux-gnu.tar.xz && \
  tar xf gcc-linaro-7.4.1-2019.02-x86_64_aarch64-linux-gnu.tar.xz && \
  mv gcc-linaro-7.4.1-2019.02-x86_64_aarch64-linux-gnu aarch64-linux-gnu && \
  rm gcc-linaro-7.4.1-2019.02-x86_64_aarch64-linux-gnu.tar.xz

# Set ENV
ENV CROSS_TRIPLE=aarch64-linux-gnu \
  XCC_PREFIX=/usr/xcc/

ENV CROSS_ROOT ${XCC_PREFIX}/${CROSS_TRIPLE}
ENV QEMU_LD_PREFIX "${CROSS_ROOT}/${CROSS_TRIPLE}/libc"

ENV AS=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-as \
    AR=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-ar \
    CC=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-gcc \
    CPP=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-cpp \
    CXX=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-g++ \
    LD=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-ld \
    FC=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-gfortran \
    NM=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-nm \
    RANLIB=${CROSS_ROOT}/bin/${CROSS_TRIPLE}-ranlib \ 
    LDFLAGS="-L${QEMU_LD_PREFIX}/usr/lib" \ 
    LIBS="-lssl -lcrypto -ldl -lpthread"

COPY Toolchain.cmake ${CROSS_ROOT}/
ENV CMAKE_TOOLCHAIN_FILE ${CROSS_ROOT}/Toolchain.cmake
