#!/usr/bin/env bash

if [ "$1" = 'jitic' ]; then
    shift
    /go/jitic "$@"
    exit_code=$?
    [ $exit_code -eq 1 ] && echo "Jira issue does not exists"
    exit $exit_code
else
  exec "$@"
fi
