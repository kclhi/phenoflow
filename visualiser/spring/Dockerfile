FROM commonworkflowlanguage/cwlviewer:v1.2.1
COPY certs/pf.pem /root
RUN keytool -importcert -file /root/pf.pem -alias selfsigned -keystore /etc/ssl/certs/java/cacerts -storepass changeit -noprompt
