#!/bin/sh
# Start or stop a throwaway regtest node in .regtest/ (git-ignored).
# Set BITCOIN_BIN_DIR to the folder holding bitcoind and bitcoin-cli if they are not on PATH.
set -eu
cd "$(dirname "$0")/.."
DATADIR="$PWD/.regtest/data"
BIN="${BITCOIN_BIN_DIR:+$BITCOIN_BIN_DIR/}"
RPCPORT="${TPOR_RPC_PORT:-18743}"
CLI="${BIN}bitcoin-cli -regtest -datadir=$DATADIR -rpcport=$RPCPORT"
case "${1:-}" in
  start)
    mkdir -p "$DATADIR"
    "${BIN}bitcoind" -regtest -datadir="$DATADIR" -daemon -listen=0 -rpcport="$RPCPORT" \
      -rpcbind=127.0.0.1 -rpcallowip=127.0.0.1 -fallbackfee=0.0001 -txindex=0
    i=0; while [ ! -f "$DATADIR/regtest/.cookie" ] && [ $i -lt 50 ]; do sleep 0.2; i=$((i+1)); done
    $CLI -rpcwait getblockcount >/dev/null
    echo "regtest node up on 127.0.0.1:$RPCPORT, datadir $DATADIR"
    ;;
  stop)
    $CLI stop || true
    ;;
  wipe)
    $CLI stop 2>/dev/null || true
    sleep 2
    rm -rf "$PWD/.regtest/data"
    ;;
  *)
    echo "usage: $0 start|stop|wipe" >&2; exit 2;;
esac
