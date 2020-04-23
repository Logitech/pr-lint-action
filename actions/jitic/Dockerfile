FROM golang:latest 
ARG jitic_version=v1.1.1
ADD docker-entrypoint.sh /docker-entrypoint.sh 
RUN go get github.com/andygrunwald/jitic && \
    go build github.com/andygrunwald/jitic
ENTRYPOINT ["/docker-entrypoint.sh"]
