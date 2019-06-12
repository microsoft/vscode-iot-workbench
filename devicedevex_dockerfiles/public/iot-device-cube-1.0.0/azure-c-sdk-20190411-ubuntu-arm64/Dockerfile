# devicedevex.azurecr.io/public/iot-device-cube:1.0.0-azure-c-sdk-20190411-ubuntu-arm64
FROM devicedevex.azurecr.io/internal/iot-device-cube:1.0.0-ubuntu-arm64

RUN mkdir /work
WORKDIR /work

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates wget perl make cmake git && \
    wget https://www.openssl.org/source/openssl-1.0.2o.tar.gz && \
    tar -xvf openssl-1.0.2o.tar.gz && \
    cd openssl-1.0.2o && \
    ./Configure linux-generic32 shared --prefix=${QEMU_LD_PREFIX}/usr --openssldir=${QEMU_LD_PREFIX}/usr && \
    make && \
    make install && \
    rm /work/openssl-1.0.2o.tar.gz && \
    rm -rf /work/openssl-1.0.2o && \
    cd .. && \
    wget http://curl.haxx.se/download/curl-7.60.0.tar.gz && \
    tar -xvf curl-7.60.0.tar.gz && \
    cd curl-7.60.0 && \
    ./configure --with-sysroot=${QEMU_LD_PREFIX} --prefix=${QEMU_LD_PREFIX}/usr --target=${CROSS_TRIPLE} --with-ssl --with-zlib --host=${CROSS_TRIPLE} --build=x86_64-pc-linux-uclibc && \
    make && \
    make install && \
    rm /work/curl-7.60.0.tar.gz && \
    rm -rf /work/curl-7.60.0 && \
    cd .. && \
    wget https://mirrors.edge.kernel.org/pub/linux/utils/util-linux/v2.32/util-linux-2.32-rc2.tar.gz && \
    tar -xvf util-linux-2.32-rc2.tar.gz && \
    cd util-linux-2.32-rc2 && \
    ./configure --prefix=${QEMU_LD_PREFIX}/usr --with-sysroot=${QEMU_LD_PREFIX} --target=${CROSS_TRIPLE} --host=${CROSS_TRIPLE} --disable-all-programs  --disable-bash-completion --enable-libuuid && \
    make && \
    make install && \
    rm /work/util-linux-2.32-rc2.tar.gz && \
    rm -rf /work/util-linux-2.32-rc2 && \
    cd .. && \
    git clone --single-branch --branch 2019-04-11 --recursive https://github.com/azure/azure-iot-sdk-c.git && \
    cd azure-iot-sdk-c && \
    mkdir cmake && \
    cd cmake && \
    cmake -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE} .. && \
    make && \
    apt-get remove -y ca-certificates wget && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*