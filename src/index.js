#!/usr/bin/env node

var pty = require('pty.js');
var EventEmitter = require('events').EventEmitter;
var child_process = require('child_process');
var smiley = require('smiley');

//
// Class encapsulates iftop as a spawned process. Completely parses iftop output
// and emits an object.
//
class IftopParser extends EventEmitter {
  //
  // Constructor initializes the iftop buffer.
  //
  constructor(iface, n=10) {
    super();
    this.iface = iface;
    this.n = n;
    this.iftopPath = 'iftop';
    this.supportedVersions = [
      '1.0pre4'
    ];
    this.defaultFilter = "not ether host ff:ff:ff:ff:ff:ff and not net 239.0.0.0/8 and not net 224.0.0.0/8";
    
    this._iftopBuffer = "";
  }
  
  //
  // Spawns the iftop process if the version is supported
  //
  start() {
    if (this.checkIftopVersion()) {
      this.spawnIftop();
    } else {
      this.emit('error', `ERROR: unsupported iftop version, we support ${JSON.stringify(this.supportedVersions)}`);
    }
  }
  
  //
  // Send iftop an 's', which toggles source aggregation
  //
  toggleAggregateSrc() {
    if (this.term) {
      this.term.write('s');
    }
  }
  
  //
  // Send iftop a 'd', which toggles destination aggregation
  //
  toggleAggregateDst() {
    if (this.term) {
      this.term.write('d');
    }
  }
  
  //
  // Send iftop an 'n', which toggles DNS resolution
  //
  toggleDNSResolution() {
    if (this.term) {
      this.term.write('n');
    }
  }
  
  //
  // Send iftop a 'p', which toggles port numbers
  //
  togglePortDisplay() {
    if (this.term) {
      this.term.write('p');
    }
  }
  
  //
  // Send the given keystroke(s) to iftop directly
  //
  sendKeystroke(str) {
    if (this.term) {
      this.term.write(str);
    }
  }
  
  //
  // Parses the (-h) output of iftop to verify the version number is in SUPPORTED_VERSIONS
  //
  checkIftopVersion() {
    var output = child_process.spawnSync(this.iftopPath, ['-h']);
    if (output.error) {
      this.emit('error', "ERROR: can't find iftop");
      return false;
    }
    var m = output.stdout.toString().match(/iftop, version ([^\s]+)\n/);
    if (m && m.length > 1 && this.supportedVersions.indexOf(m[1]) > -1) {
      return true;
    }
    return false;
  }
  
  //
  // Spawn iftop as a pty process
  //
  spawnIftop() {
    this.term = pty.spawn(this.iftopPath, ["-i", this.iface, "-t", "-L", this.n, "-p", "-f", this.defaultFilter, "-N"], {
      name: 'xterm-color',
      cols: 120,
      rows: 60,
      cwd: process.env.HOME,
      env: process.env
    });
    
    this.term.on('data', (data) => {
      if (data.match(/No such device/)) {
        this.emit('error', "ERROR: can't find specified device");
      } else {
        this.handleData(data);
      }
    });
  }
  
  //
  // Handle incoming data from iftop pty
  //
  handleData(d) {
    this._iftopBuffer += d;
  
    // see if we have any complete entries
    var beg = this._iftopBuffer.indexOf("   # Host name");
    var end = this._iftopBuffer.lastIndexOf("============================================================================================");
    if (beg > 0 && end > 0) {
      // get full entries (could be multiple)
      var full = this._iftopBuffer.slice(beg, end);
      // trim off front
      this._iftopBuffer = this._iftopBuffer.slice(end);
      
      // split full entries
      var entries = full.split("============================================================================================");
      for (let ent of entries) {
        if (ent.match(/^\s{3,4}# Host/)) {
          var p = ent.split("--------------------------------------------------------------------------------------------");
          var ary = p[1].split(/^(   \d|  \d{2})/m);
    
          var obj = {
            flows: []
          };
          
          // parse flows, iterate by 2 b/c evens contain line indices
          for (let i=2; i<ary.length; i+=2) {
            var flowLine = ary[i].match(/^[ ]{1,2}([^\s]+)\s+=>\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?B)\s+([^\s]+)\s+<=\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?B)/m);
            
            obj.flows.push({
              src: flowLine[1],
              src2: smiley.iecToDecimal(flowLine[2]),
              src10: smiley.iecToDecimal(flowLine[3]),
              src40: smiley.iecToDecimal(flowLine[4]),
              srcCum: smiley.iecToDecimal(flowLine[5]),
              dst: flowLine[6],
              dst2: smiley.iecToDecimal(flowLine[7]),
              dst10: smiley.iecToDecimal(flowLine[8]),
              dst40: smiley.iecToDecimal(flowLine[9]),
              dstCum: smiley.iecToDecimal(flowLine[10])
            });
          }

          // parse send and receive rates
          var rateLine = p[2].match(/Total send rate:\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+Total receive rate:\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+Total send and receive rate:\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)/);
          obj.send2 = smiley.iecToDecimal(rateLine[1]);
          obj.send10 = smiley.iecToDecimal(rateLine[2]);
          obj.send40 = smiley.iecToDecimal(rateLine[3]);
          obj.receive2 = smiley.iecToDecimal(rateLine[4]);
          obj.receive10 = smiley.iecToDecimal(rateLine[5]);
          obj.receive40 = smiley.iecToDecimal(rateLine[6]);
          obj.both2 = smiley.iecToDecimal(rateLine[7]);
          obj.both10 = smiley.iecToDecimal(rateLine[8]);
          obj.both40 = smiley.iecToDecimal(rateLine[9]);
          
          // parse peak and cumulative
          var peakLine = p[3].match(/Peak rate \(sent\/received\/total\):\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+Cumulative \(sent\/received\/total\):\s+([0-9\.]+M?K?B)\s+([0-9\.]+M?K?B)\s+([0-9\.]+M?K?B)/);
          obj.peakSent = smiley.iecToDecimal(peakLine[1]);
          obj.peakReceived = smiley.iecToDecimal(peakLine[2]);
          obj.peakTotal = smiley.iecToDecimal(peakLine[3]);
          obj.cumSent = smiley.iecToDecimal(peakLine[4]);
          obj.cumReceived = smiley.iecToDecimal(peakLine[5]);
          obj.cumTotal = smiley.iecToDecimal(peakLine[6]);

          this.emit('data', obj);
        }
      }
    }
  }
}

//
// Exports
//
module.exports = IftopParser;

//
// Standalone test mode
//
if (require.main === module) {
  
  var iftop = new IftopParser('eth0');
  iftop.on('error', (e) => {
    console.error(e);
  });
  iftop.on('data', (d) => {
    console.log(d);
  });
    
  iftop.toggleAggregateDst();
  iftop.start();
  
  setTimeout(function() {
    iftop.togglePortDisplay();
  }, 10000);
}