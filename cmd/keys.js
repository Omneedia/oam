module.exports = function(args, root) {
    require('dotenv').config({
        path: global.config.datastore + '/.omneedia-ci/api/.env',
    });
    const inquirer = require('inquirer');
    const shelljs = require('shelljs');
    const yaml = require('yaml');
    const providers = require(__dirname + '/providers.json');
    const fs = require('fs');
    const chalk = require('chalk');
    fs.writeFile('keys.json', JSON.stringify(global.config.key, null, 4), function(e) {
        console.log("your keys has been saved to keys.json.\nPlease keep this file in a safe place.");
    });
};