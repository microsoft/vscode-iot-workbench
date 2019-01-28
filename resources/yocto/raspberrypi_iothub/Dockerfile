From crops/yocto:ubuntu-16.04-base

# Run commands that require root authority
USER root

# Fetch and install all outstanding updates
RUN apt-get update && apt-get -y upgrade

# Install cmake, git, wget and nano
RUN apt-get install -y cmake git wget nano curl

RUN mkdir /workdir
RUN chown -R 1000:1000 /workdir

# setup new user builder so that we don't run it all as root
RUN groupadd -o -g $(stat -c "%g" /workdir) "builder"
RUN useradd -N -g $(stat -c "%g" /workdir) -m -o -u $(stat -c "%u" /workdir) -p builder "builder"
USER builder

# Download yocto esdk-container
WORKDIR /workdir
RUN curl -# -o esdk_install.sh http://downloads.yoctoproject.org/releases/yocto/yocto-2.6/toolchain/x86_64/poky-glibc-x86_64-core-image-minimal-aarch64-toolchain-ext-2.6.sh

# setup sdk
RUN chmod 777 ./esdk_install.sh
RUN /bin/bash -c "/workdir/esdk_install.sh -d /workdir -y"

# Create a work directory and switch to it
RUN mkdir AzureBuild
WORKDIR AzureBuild

# Download the Azure IoT SDK for C
RUN git clone --recursive https://github.com/azure/azure-iot-sdk-c.git

# Download OpenSSL source and expand it
RUN wget https://www.openssl.org/source/openssl-1.0.2o.tar.gz
RUN tar -xvf openssl-1.0.2o.tar.gz

# Download cURL source and expand it
RUN wget http://curl.haxx.se/download/curl-7.60.0.tar.gz
RUN tar -xvf curl-7.60.0.tar.gz

# Download the Linux utilities for libuuid and expand it
RUN wget https://mirrors.edge.kernel.org/pub/linux/utils/util-linux/v2.32/util-linux-2.32-rc2.tar.gz
RUN tar -xvf util-linux-2.32-rc2.tar.gz

# Set up environment variables in preparation for the builds to follow
ENV SDKTARGETSYSROOT=/workdir/tmp/sysroots/qemuarm64
ENV PATH=/workdir/tmp/sysroots/x86_64/usr/bin:/workdir/tmp/sysroots/x86_64/usr/sbin:/workdir/tmp/sysroots/x86_64/bin:/workdir/tmp/sysroots/x86_64/sbin:/workdir/tmp/sysroots/x86_64/usr/bin/../x86_64-pokysdk-linux/bin:/workdir/tmp/sysroots/x86_64/usr/bin/aarch64-poky-linux:/workdir/tmp/sysroots/x86_64/usr/bin/aarch64-poky-linux-musl:$PATH
ENV CC="aarch64-poky-linux-gcc  --sysroot=$SDKTARGETSYSROOT"
ENV AS="aarch64-poky-linux-as "
ENV AR=aarch64-poky-linux-ar
ENV NM=aarch64-poky-linux-nm
ENV RANLIB=aarch64-poky-linux-ranlib
ENV LD="aarch64-poky-linux-ld  --sysroot=$SDKTARGETSYSROOT"
ENV LDFLAGS="-Wl,-O1 -Wl,--hash-style=gnu -Wl,--as-needed"

ENV WORK_ROOT=/workdir/AzureBuild
ENV TOOLCHAIN_PREFIX=${SDKTARGETSYSROOT}/usr
ENV TOOLCHAIN_NAME=aarch64-poky-linux

# Build OpenSSL
WORKDIR openssl-1.0.2o
RUN ./Configure linux-aarch64 shared --prefix=${TOOLCHAIN_PREFIX} --openssldir=${TOOLCHAIN_PREFIX}
RUN make
RUN make install
WORKDIR ..

# Build cURL
WORKDIR curl-7.60.0
RUN ./configure --with-sysroot=${SDKTARGETSYSROOT} --prefix=${TOOLCHAIN_PREFIX} --target=${TOOLCHAIN_NAME} --with-ssl --with-zlib --host=${TOOLCHAIN_NAME} --build=x86_64-pc-linux-uclibc
RUN make
RUN make install
WORKDIR ..

# Build uuid
WORKDIR util-linux-2.32-rc2
RUN ./configure --prefix=${TOOLCHAIN_PREFIX} --with-sysroot=${SDKTARGETSYSROOT} --target=${TOOLCHAIN_NAME} --host=${TOOLCHAIN_NAME} --disable-all-programs  --disable-bash-completion --enable-libuuid
RUN make
RUN make install
WORKDIR ..

# To build the SDK we need to create a cmake toolchain file. This tells cmake to use the tools in the toolchain rather than those on the host
WORKDIR azure-iot-sdk-c

# Create a working directory for the cmake operations
RUN mkdir cmake
WORKDIR cmake

# Create a cmake toolchain file on the fly
RUN echo "SET(CMAKE_SYSTEM_NAME Linux)     # this one is important" > toolchain.cmake
RUN echo "SET(CMAKE_SYSTEM_VERSION 1)      # this one not so much" >> toolchain.cmake
RUN echo "SET(CMAKE_SYSROOT ${SDKTARGETSYSROOT})" >> toolchain.cmake
RUN echo "SET(CMAKE_C_COMPILER ${CC})" >> toolchain.cmake
RUN echo "SET(CMAKE_CXX_COMPILER ${CXX})" >> toolchain.cmake
RUN echo "SET(CMAKE_FIND_ROOT_PATH ${SDKTARGETSYSROOT})" >> toolchain.cmake
RUN echo "SET(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)" >> toolchain.cmake
RUN echo "SET(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)" >> toolchain.cmake
RUN echo "SET(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)" >> toolchain.cmake
RUN echo "SET(set_trusted_cert_in_samples true CACHE BOOL \"Force use of TrustedCerts option\" FORCE)" >> toolchain.cmake

# Build the SDK. This will use the OpenSSL, cURL and uuid binaries that we built before
RUN cmake -DCMAKE_TOOLCHAIN_FILE=toolchain.cmake -DCMAKE_INSTALL_PREFIX=${TOOLCHAIN_PREFIX} ..
RUN make
RUN make install

# Finally a sanity check to make sure the files are there
RUN ls -al ${TOOLCHAIN_PREFIX}/lib
RUN ls -al ${TOOLCHAIN_PREFIX}/include

# Go to project root
WORKDIR ../..

# Build your Azure application
# Copy a directory from the host containing the files to build setting ownership at the same time
ADD --chown=builder:builder azureIoT  ${WORK_ROOT}/azureIoT

# Sanity check
RUN ls -al azureIoT

# Switch to application directory
WORKDIR azureIoT

# Create and switch to cmake directory
RUN mkdir cmake
WORKDIR cmake

# Generate the makefiles with the same toolchain file and build
RUN cmake -DCMAKE_TOOLCHAIN_FILE=${WORK_ROOT}/azure-iot-sdk-c/cmake/toolchain.cmake ..
RUN make

# There should be an executable called azureIoT
RUN ls -al azureIoT