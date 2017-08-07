# Base docker image
FROM ubuntu:16.04

## PART 1: Core components
## =======================

# Install utilities
RUN apt-get update --fix-missing && apt-get -y upgrade &&\
apt-get install -y sudo curl wget unzip git

# Install node 7 Using Ubuntu
RUN curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash - &&\
sudo apt-get install -y nodejs

# Install Chrome for Ubuntu
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add - &&\
sudo sh -c 'echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' &&\
sudo apt-get update &&\
sudo apt-get install -y google-chrome-unstable

# dependencies for node-gyp which is needed for nsqjs module
# build base includes g++ and gcc and Make
RUN sudo apt-get install -y python build-essential 

## PART 2: Removing System Config limits for Google Chromium
## =========================================================
RUN echo "DefaultTasksMax=infinity" >> /etc/systemd/system.conf \
echo "DefaultLimitNOFILE=10000000" >> /etc/systemd/system.conf \
echo "UserTasksMax=infinity" >> /etc/systemd/logind.conf

RUN echo "* soft     nproc          unlimited" >> /etc/security/limits.conf \
echo "* hard     nproc          unlimited" >> /etc/security/limits.conf \
echo "* soft     nofile         unlimited" >> /etc/security/limits.conf \
echo "* hard     nofile         unlimited" >> /etc/security/limits.conf \
echo "root soft     nofile         unlimited" >> /etc/security/limits.conf \
echo "root hard     nofile         unlimited" >> /etc/security/limits.conf

## PART 3: TrackinOps Crawler
## ==========================

# Download TrackinOps from git source.
RUN git clone https://github.com/darvydas/trackinops-crawler /usr/src/app/trackinops-crawler &&\
cd /usr/src/app/trackinops-crawler 
# &&\
# git checkout tags/v0.1 &&\
# npm install

# # Build TrackinOps from source locally.
# RUN mkdir -p /usr/src/app/trackinops-crawler
# COPY . /usr/src/app/trackinops-crawler

# Copy configuration file from local source
COPY ./package.json /usr/src/app/trackinops-crawler/package.json
COPY ./configuration.js /usr/src/app/trackinops-crawler/configuration.js

# setup Working Directory
WORKDIR /usr/src/app/trackinops-crawler
RUN npm install

## PART 4: Final setup
## ===================

# Add a user and make it a sudo user
RUN useradd -m chromeuser &&\
sudo adduser chromeuser sudo

# Copy the chrome-user script used to start Chrome as non-root
COPY chromeuser-script.sh /
RUN chmod +x /chromeuser-script.sh

# Set the entrypoint
COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

CMD NODE_ENV=production node --max_old_space_size=4096 index.js