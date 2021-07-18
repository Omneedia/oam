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
    const genpass = require('generate-password');
    const genuser = require('username-generator');

    const DIR_STACK = 'omneedia-core-web-prod';
    const DIR_NGINX = `${global.config.datastore}/${DIR_STACK}_etc`;
    const DIR_BOT = `${global.config.datastore}/${DIR_STACK}_robocert`;
    const DIR_CERTS = `${global.config.datastore}/${DIR_STACK}_certs`;

    console.log(global.logo);

    var dns = {
        acme: {},
        profiles: [],
        certificates: [],
    };

    inquirer
        .prompt([{
                type: 'input',
                name: 'domain',
                message: 'default domain',
                default: 'omneedia.net',
            },
            {
                type: 'input',
                name: 'email',
                message: 'please provide your public email address',
                default: 'jon.snow@winterfell.com',
            },
        ])
        .then(function(response) {
            var hosts = [];
            for (var el in providers) hosts.push(el);
            inquirer
                .prompt([{
                    type: 'list',
                    choices: hosts,
                    name: 'provider',
                    message: 'choose your DNS Providers',
                }, ])
                .then(function(r) {
                    var params = [];
                    for (var el in providers[r.provider]) {
                        params.push({
                            name: el,
                            message: providers[r.provider][el],
                            type: 'input',
                        });
                    }
                    inquirer.prompt(params).then(function(o) {
                        var profile = {
                            name: 'default',
                            provider: r.provider,
                            provider_options: {},
                        };
                        dns.acme.email_account = response.email;
                        for (var el in o) {
                            if (o[el]) profile.provider_options[el] = o[el];
                        }
                        dns.profiles.push(profile);
                        var domains = [response.domain, '*.' + response.domain];
                        dns.certificates.push({
                            profile: 'default',
                            domains: domains,
                        });
                        var txt = yaml.stringify(dns);
                        fs.readFile(
                            `${__dirname}/default.config`,
                            'utf-8',
                            function(e, cfg) {
                                cfg = cfg.replace(/\${DOMAIN}/g, response.domain);
                                fs.writeFile(
                                    `${DIR_NGINX}/sites-enabled/_.${response.domain}.conf`,
                                    cfg,
                                    function() {
                                        fs.unlink(
                                            `${DIR_NGINX}/sites-enabled/_.conf`,
                                            function() {
                                                fs.writeFile(
                                                    `${DIR_BOT}/config.yml`,
                                                    txt,
                                                    function() {
                                                        console.log(chalk.bold('\nok.'));
                                                        var ENV = {
                                                            OMNEEDIA_DEFAULT_DOMAIN: response.domain,
                                                            OMNEEDIA_REGISTRY_USER: genuser.generateUsername('-'),
                                                            OMNEEDIA_REGISTRY_PASSWORD: genpass.generate({
                                                                length: 10,
                                                                numbers: true,
                                                            }),
                                                            OMNEEDIA_ROOT_CONFIG: global.config.datastore + '/.omneedia-ci',
                                                            OMNEEDIA_ROOT_CERTS: DIR_CERTS,
                                                            OMNEEDIA_ROOT_BOT: DIR_BOT,
                                                            OMNEEDIA_REGISTRY_URI: 'registry.' + response.domain,
                                                        };
                                                        var env = [];
                                                        for (var el in ENV) env.push(el + '=' + ENV[el]);
                                                        fs.readFile(
                                                            global.config.datastore +
                                                            '/.omneedia-ci/api/.env',
                                                            'utf-8',
                                                            function(e, r) {
                                                                var api = r.split('\n');
                                                                api = api.concat(env);
                                                                fs.writeFile(
                                                                    global.config.datastore +
                                                                    '/.omneedia-ci/api/.env',
                                                                    api.join('\n'),
                                                                    function() {
                                                                        console.log('Done.');
                                                                    }
                                                                );
                                                            }
                                                        );
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    });
                })
                .catch(function(e) {});
        });
};