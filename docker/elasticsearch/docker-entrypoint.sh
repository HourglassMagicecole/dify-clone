#!/bin/bash

set -e

if [ "${VECTOR_STORE}" = "elasticsearch-ja" ]; then
    # Check if the ICU tokenizer plugin is installed
    if ! /usr/share/elasticsearch/bin/elasticsearch-plugin list | grep -q analysis-icu; then
        printf '%s\n' "Installing the ICU tokenizer plugin"
        if ! /usr/share/elasticsearch/bin/elasticsearch-plugin install analysis-icu; then
            printf '%s\n' "Failed to install the ICU tokenizer plugin"
            exit 1
        fi
    fi
    # Check if the Japanese language analyzer plugin is installed
    if ! /usr/share/elasticsearch/bin/elasticsearch-plugin list | grep -q analysis-kuromoji; then
        printf '%s\n' "Installing the Japanese language analyzer plugin"
        if ! /usr/share/elasticsearch/bin/elasticsearch-plugin install analysis-kuromoji; then
            printf '%s\n' "Failed to install the Japanese language analyzer plugin"
            exit 1
        fi
    fi
fi

if [ "${VECTOR_STORE}" = "elasticsearch-ko" ]; then
    # Check if the ICU tokenizer plugin is installed (for normalization)
    if ! /usr/share/elasticsearch/bin/elasticsearch-plugin list | grep -q analysis-icu; then
        printf '%s\n' "Installing the ICU tokenizer plugin"
        if ! /usr/share/elasticsearch/bin/elasticsearch-plugin install analysis-icu; then
            printf '%s\n' "Failed to install the ICU tokenizer plugin"
            exit 1
        fi
    fi
    # Check if the Korean language analyzer plugin (Nori) is installed
    if ! /usr/share/elasticsearch/bin/elasticsearch-plugin list | grep -q analysis-nori; then
        printf '%s\n' "Installing the Korean language analyzer plugin (Nori)"
        if ! /usr/share/elasticsearch/bin/elasticsearch-plugin install analysis-nori; then
            printf '%s\n' "Failed to install the Korean language analyzer plugin"
            exit 1
        fi
    fi
fi

# Run the original entrypoint script
exec /bin/tini -- /usr/local/bin/docker-entrypoint.sh
