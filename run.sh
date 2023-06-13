#!/bin/bash

#npm install pm2 -g

pm2 stop TrendingCXDX-polygon-WMATIC-USDC

pm2 del TrendingCXDX-polygon-WMATIC-USDC

pm2 start pm2.config.js
