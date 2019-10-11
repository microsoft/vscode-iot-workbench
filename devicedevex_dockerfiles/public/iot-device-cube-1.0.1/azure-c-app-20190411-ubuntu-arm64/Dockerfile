# devicedevex.azurecr.io/public/iot-device-cube:1.0.1-azure-c-app-20190411-ubuntu-arm64
ARG base_image_tag=1.0.0-azure-c-sdk-20190411-ubuntu-arm64
FROM devicedevex.azurecr.io/public/iot-device-cube:${base_image_tag}

RUN cp /work/azure-iot-sdk-c/CMakeLists.txt /work/azure-iot-sdk-c/default_CMakeLists.txt
COPY compile_app.sh /work/