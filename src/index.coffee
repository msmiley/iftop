#!/usr/bin/env coffee

pty = require 'pty.js'
{ EventEmitter } = require 'events'
child_process = require 'child_process'
smiley = require 'smiley'

#
# Class encapsulates iftop as a spawned process. Completely parses iftop output
# and emits an object.
#
class IftopParser extends EventEmitter
  @PATH: 'iftop'
  @SUPPORTED_VERSIONS: [
    '1.0pre4'
  ]
  @DEFAULT_BPF: "not ether host ff:ff:ff:ff:ff:ff and not net 239.0.0.0/8 and not net 224.0.0.0/8"

  constructor: (@iface, @n=10) ->
    @_iftopBuffer = ""

  start: ->
    if @checkIftopVersion()
      @spawnIftop()
    else
      @emit 'error', "ERROR: unsupported iftop version, we support #{JSON.stringify IftopParser.SUPPORTED_VERSIONS}"
  
  toggleAggregateSrc: ->
    @term.write 's' if @term
  
  toggleAggregateDst: ->
    @term.write 'd' if @term

  toggleDNSResolution: ->
    @term.write 'n' if @term
  
  togglePortDisplay: ->
    @term.write 'p' if @term
  
  checkIftopVersion: ->
    output = child_process.spawnSync IftopParser.PATH, ['-h']
    if output.error
      @emit 'error', "ERROR: can't find iftop"
    m = output.stdout.toString().match /iftop, version ([^\s]+)\n/
    if m and m.length > 1 and m[1] in IftopParser.SUPPORTED_VERSIONS
      return true
    return false
    
  spawnIftop: ->
    @term = pty.spawn IftopParser.PATH, ["-i", @iface, "-t", "-L", @n, "-p", "-f", IftopParser.DEFAULT_BPF, "-N"],
      name: 'xterm-color'
      cols: 120
      rows: 60
      cwd: process.env.HOME
      env: process.env
    
    @term.on 'data', (data) =>
      if data.match /No such device/
        @emit 'error', "ERROR: can't find specified device"
      else
        @handleData data

  handleData: (d) ->
    @_iftopBuffer += d
  
    # see if we have any complete entries
    beg = @_iftopBuffer.indexOf("   # Host name")
    end = @_iftopBuffer.lastIndexOf("============================================================================================")
    if beg > 0 and end > 0
      # get full entries (could be multiple)
      full = @_iftopBuffer[beg...end]
      # trim off front
      @_iftopBuffer = @_iftopBuffer[end..]
      
      # split full entries
      entries = full.split("============================================================================================")
      for ent in entries
        if ent.match /^\s{3,4}# Host/
          p = ent.split("--------------------------------------------------------------------------------------------")
          ary = p[1].split /^(   \d|  \d{2})/m
    
          obj =
            flows: []
          
          # parse flows, iterate by 2 b/c evens contain line indices
          for e in ary[2..] by 2
            flowLine = e.match /^[ ]{1,2}([^\s]+)\s+=>\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?B)\s+([^\s]+)\s+<=\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?B)/m
            
            obj.flows.push
              src: flowLine[1]
              src2: smiley.iecToDecimal flowLine[2]
              src10: smiley.iecToDecimal flowLine[3]
              src40: smiley.iecToDecimal flowLine[4]
              srcCum: smiley.iecToDecimal flowLine[5]
              dst: flowLine[6]
              dst2: smiley.iecToDecimal flowLine[7]
              dst10: smiley.iecToDecimal flowLine[8]
              dst40: smiley.iecToDecimal flowLine[9]
              dstCum: smiley.iecToDecimal flowLine[10]

          # parse send and receive rates
          rateLine = p[2].match /Total send rate:\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+Total receive rate:\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+Total send and receive rate:\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)/
          obj.send2 = smiley.iecToDecimal rateLine[1]
          obj.send10 = smiley.iecToDecimal rateLine[2]
          obj.send40 = smiley.iecToDecimal rateLine[3]
          obj.receive2 = smiley.iecToDecimal rateLine[4]
          obj.receive10 = smiley.iecToDecimal rateLine[5]
          obj.receive40 = smiley.iecToDecimal rateLine[6]
          obj.both2 = smiley.iecToDecimal rateLine[7]
          obj.both10 = smiley.iecToDecimal rateLine[8]
          obj.both40 = smiley.iecToDecimal rateLine[9]
          
          # parse peak and cumulative
          peakLine = p[3].match /Peak rate \(sent\/received\/total\):\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+([0-9\.]+M?K?b)\s+Cumulative \(sent\/received\/total\):\s+([0-9\.]+M?K?B)\s+([0-9\.]+M?K?B)\s+([0-9\.]+M?K?B)/
          obj.peakSent = smiley.iecToDecimal peakLine[1]
          obj.peakReceived = smiley.iecToDecimal peakLine[2]
          obj.peakTotal = smiley.iecToDecimal peakLine[3]
          obj.cumSent = smiley.iecToDecimal peakLine[4]
          obj.cumReceived = smiley.iecToDecimal peakLine[5]
          obj.cumTotal = smiley.iecToDecimal peakLine[6]

          @emit 'data', obj

module.exports = IftopParser

main = ->
  
  iftop = new IftopParser('eth0', 20)
  iftop.on 'error', (e) ->
    console.error e
  iftop.on 'data', (d) ->
    console.log d
    
  iftop.toggleAggregateDst()
  iftop.start()
  
  setTimeout ->
    iftop.togglePortDisplay()
  , 10000
  
do main if require.main is module