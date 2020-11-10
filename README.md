# iftop

Use the power and speed of [iftop](http://www.ex-parrot.com/pdw/iftop/) to get flow rates and totals of traffic incident on a network device.

Note that the user running this process will need capture permissions on the specified device.

Examples of how this is typically done:

linux:

```bash
sudo setcap cap_net_raw,cap_net_admin=eip /usr/sbin/iftop
```

macOS:

```bash
sudo chmod +r /dev/bpf*
```

## Usage

```js
const IftopParser = require('iftop');

IftopParser.iftopPath = "/usr/sbin/iftop"; // only if iftop is not on the path

var iftop = new IftopParser("eth0");

// set up error handler
iftop.on('error', (e) => {
    console.error(e);
});

// set up data handler
iftop.on('data', (d) => {
    console.log(d);
});

iftop.start();

// optional manipulations after start() has been called (these are passed to iftop)
iftop.toggleAggregateSrc();
iftop.toggleAggregateDst();
iftop.toggleDNSResolution();
iftop.togglePortDisplay();

```

## License

ISC
