FROM devicedevex.azurecr.io/public/azure-sdk:latest

WORKDIR /work/AzureBuild
COPY source  /work/AzureBuild/{PROJECT_NAME}

RUN ls -al {PROJECT_NAME} && \
    cd {PROJECT_NAME} && \
    mkdir cmake && \
    cd cmake && \
    cmake -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE} .. && \
    make && \
    ls -al {PROJECT_NAME}
