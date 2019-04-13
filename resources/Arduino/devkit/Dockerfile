FROM arduino_base:0.1.0

# Use root as the user
USER root
ENV USER root

# Add aditional Url to download AZ3166 package
COPY arduino-cli.yaml /work/

# DevKit start sctript: Install AZ3166 package
COPY devkit_start.sh /usr/bin/devkit_start.sh

# User application code
RUN mkdir /work/device
COPY device.ino /work/device/

ENTRYPOINT [ "/usr/bin/devkit_start.sh" ]