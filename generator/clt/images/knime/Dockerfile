FROM ubuntu:16.04

RUN \
  sed -i 's/# \(.*multiverse$\)/\1/g' /etc/apt/sources.list && \
  apt-get update && \
  apt-get -y upgrade && \
  apt-get install -y build-essential && \
  apt-get install -y software-properties-common && \
  apt-get install -y unzip

ENV HOME /root
WORKDIR /root

RUN apt-get install -y openjdk-8-jre-headless

ENV JAVA_HOME /usr/lib/jvm/java-8-oracle

RUN rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1000 -o kclhi
RUN useradd -m -u 1000 -g 1000 -o -s /bin/bash kclhi
USER kclhi

ENV HOME /home/kclhi
WORKDIR /home/kclhi

ADD --chown=kclhi:kclhi http://download.knime.org/analytics-platform/linux/knime_4.1.1.linux.gtk.x86_64.tar.gz .
RUN tar -xvf knime_4.1.1.linux.gtk.x86_64.tar.gz -C .
RUN chmod +x knime_4.1.1/knime

# Install bundles (optional)
#RUN ./knime -nosplash -application org.eclipse.equinox.p2.director \
#    -consolelog -r http://update.knime.com/analytics-platform/4.0 -i org.apache.cxf.cxf-rt-transports-http,org.apache.cxf.cxf-rt-transports-http-hc \
#    -bundlepool knime_4.1.1 \
#    -d knime_4.1.1


CMD ["knime"]
