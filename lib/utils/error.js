module.exports = function(err) {
    var logSymbols = require('log-symbols');
    var boxen = require('boxen');
    var chalk = require('chalk');

    var error = '\n ' + logSymbols.error + ' FATAL ERROR: ' + err + ' ';
    console.log(chalk.red.bold(error) + '\n');
    process.exit(0);
}