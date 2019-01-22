# Sample Bitcoin RPC App

Study material for understanding various real scenarios and it's effect on the Bitcoin RPC usage.

Built by [Karl-Johan Alm](https://github.com/kallewoof) as training material for the [Blockchain Core Camp (BC2)](https://bc-2.jp/) workshop, this is for educational purposes only and not intended to be used in a production app.

## Getting Started

### Prerequisites

Currently this works on macOS & GNU/Linux only.

Make sure you have the following installed:
* [Bitcoin Core](https://github.com/bitcoin/bitcoin)
* [Node.js](https://nodejs.org/en/)
* [MongoDB](https://www.mongodb.com/)
* [Mocha](http://mochajs.org/)

You can install those yourself, or follow these instructions.

For macOS (assuming you have Homebrew installed):

```
$ brew install node mongodb
$ brew services start mongodb
$ npm install -g mocha #sometimes this might require sudo
```

For Ubuntu 64-bit:

```
$ sudo apt install curl
$ curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
$ sudo apt install nodejs mongodb
$ sudo systemctl start mongodb
$ sudo systemctl enable mongodb
$ sudo ln -s /usr/bin/nodejs /usr/local/bin/node # Buggy if Nodejs is not installed
$ sudo npm install -g mocha
```

### Installing

If you're on macOS and downloaded from [https://bitcoincore.org/en/download](https://bitcoincore.org/en/download), follow the "Alternate Install" instructions.

After downloading, extract the files to some folder (henceforth referred to as the rpcapp folder). From that folder, run `npm install` to get the necessary files:

```
$ npm install
```

By default, this app uses `rpcuser=user` and `rpcpassword=password`, so either set those setting inside the [bitcoin.conf](https://en.bitcoin.it/wiki/Running_Bitcoin#Bitcoin.conf_Configuration_File) or change `config.js`.

If there are no issues, running ./rpc-cli should show something like this:

```
$ ./rpc-cli
available commands:
  create <amount> ...
  [...]
```

### Alternate install (macOS)

Set the `BITCOIN_PATH` to the Bitcoin-Qt app folder. By default, it's in your Applications folder.

```
$ export BITCOIN_PATH=/Applications/Bitcoin-Qt.app/Contents/MacOS/
```

Same as the above, from your RPCApp folder, run `npm install` to get the necessary files:

```
$ cd /<YOUR_RPCAPP_FOLDER>/
$ npm install
```

Similarly, if there are no issues, running ./rpc-cli should show something like this:

```
$ ./rpc-cli
available commands:
  create <amount> ...
  [...]
```

## Running the tests

Run npm test and work through the outputs:

```
$ npm test
```

## License

This project is licensed under the MIT License. See the [https://opensource.org/licenses/MIT](https://opensource.org/licenses/MIT) for more information.
