# devicedevex.azurecr.io/public/iot-device-cube:1.0.0-arduino-az3166-1.6.2
FROM devicedevex.azurecr.io/internal/iot-device-cube:1.0.0-arduino-base-0.3.6-alpha.preview

ARG AZ3166_version=1.6.2

# Use root as the user
USER root
ENV USER root

# Add aditional Url to download AZ3166 package
COPY arduino-cli.yaml /
COPY install_az3166.sh /work

# Install AZ3166
RUN /work/install_az3166.sh ${AZ3166_version}

