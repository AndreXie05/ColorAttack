#!/bin/bash
# Servidor local sem cache (os módulos JS precisam de http, não de file://)
cd "$(dirname "$0")" && python3 serve.py 8000
