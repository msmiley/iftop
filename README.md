# iftop

Use the power and speed of iftop to get flow rates and totals of traffic incident on a network device.

Note that the user running this process will need capture permissions on the specified device.

Examples of how this is done:

linux:

```bash
sudo setcap cap_net_raw,cap_net_admin=eip /usr/bin/node
```

macOS:

```bash
sudo chmod +r /dev/bpf*
```

## Usage

```coffee
IftopParser = require 'iftop'

IftopParser.PATH = "/usr/sbin/iftop" # only if needed, if iftop is on the path, shouldn't need this

iftop = new IftopParser("eth0")

# set up error handler
iftop.on 'error', (e) ->
    console.error e

# set up data handler
iftop.on 'data', (d) ->
    console.log d

iftop.start()

# optional manipulations after start() has been called
iftop.toggleAggregateSrc()
iftop.toggleAggregateDst()
iftop.toggleDNSResolution()
iftop.togglePortDisplay()

```

## License

ISC