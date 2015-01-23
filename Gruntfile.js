module.exports = function(grunt) {

    grunt.initConfig({

        // Configuration ------------------------------------------------------
        pkg: grunt.file.readJSON('package.json'),

        // Tasks --------------------------------------------------------------
        env: {
            loopback: {
                NETWORK_INTERFACE: 'loopback'
            }
        },

        mochaTest: {

            test: {
                options: {
                    reporter: 'spec',
                    clearRequireCache: true
                },
                src: ['test/**/*.test.js']
            },

            loopback: {
                options: {
                    reporter: 'spec',
                    clearRequireCache: true
                },
                src: ['test/**/*.test.js']
            }

        },

        mocha_istanbul: {
            coverage: {
                src: 'test',
                options: {
                    coverage: true,
                    check: {
                        lines: 75,
                        statements: 75,
                    },
                    root: './lib',
                    reportFormats: ['text-summary', 'html']
                }
            }
        }

    });

    // Custom Tasks -----------------------------------------------------------
    grunt.registerTask('build', function() {

        var header = '(function() { var require = function(mod) { if (mod === "bluebird") { return Promise; } };',
            footer = '})()';

        var done = this.async(),
            fs = require('fs'),
            b = require('browserify')();

        b.add('./lib/client/index.js');
        b.exclude('node_modules/bluebird/js/main/bluebird.js');

        b.bundle(function(err, buf) {

            try {
                fs.mkdirSync('dist');

            } catch(e) {
            }

            fs.writeFileSync(
                'dist/cobalt.js',
                (header + buf + footer).replace(/require/g, '_require')
            );

            done();

        });

    });


    // NPM Tasks --------------------------------------------------------------
    grunt.loadNpmTasks('grunt-env');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-mocha-istanbul');

    // Public Tasks -----------------------------------------------------------
    grunt.registerTask('test', ['lithium', 'loopback']);
    grunt.registerTask('lithium', ['mochaTest:test']);
    grunt.registerTask('loopback', ['env:loopback', 'mochaTest:loopback']);
    grunt.registerTask('coverage', ['mocha_istanbul:coverage']);

};

