fs = require 'fs'
{exec,spawn} = require 'child_process'
util = require 'util'

task 'watch', 'Watch source files and build changes', ->
  watch = spawn "./node_modules/.bin/coffee", ['-cw', '--no-header', '-o', 'lib', 'src']
  watch.stdout.on 'data', (data) -> console.log data.toString().trim()

task 'build', 'Compile all CoffeeScript files', ->
  # prepare lib directory
  if not fs.existsSync 'lib'
    fs.mkdirSync 'lib'

  # run coffee-script compile
  exec "./node_modules/.bin/coffee -c --no-header -o lib src", (err, stdout, stderr) ->
    if err
      util.log err
      process.exit 1 # abort npm packaging
    util.log "Compiled CoffeeScript."

task 'docs', 'Generate documentation', ->
  exec "./node_modules/.bin/docco src/*", (err, stdout, stderr) ->
    if err
      util.log "Docco Failed - \n#{stdout}"
      process.exit 1 # abort npm packaging
    util.log("Docco generated documentation - \n#{stdout}")
