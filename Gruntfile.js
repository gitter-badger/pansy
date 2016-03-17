'use strict'

var _ = require('lodash')

var tasks = [
  'uglify',
  'webpack'
]

var conf = {}

_.map(tasks, function(item, index){
  conf[item] = {}
  conf[item] = _.assign(conf[item], require('./scripts/grunt/release/'+item))
})


module.exports = function(grunt){

  conf.pkg = grunt.file.readJSON('package.json')

  grunt.initConfig(conf);

  grunt.registerTask('default', [
    'webpack:indexJS',
    'uglify:indexJS'
  ])

  grunt.loadNpmTasks('grunt-webpack');
  grunt.loadNpmTasks('grunt-contrib-uglify');


}