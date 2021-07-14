module.exports = function(args, root) {
    require('dotenv').config({
        path: global.config.datastore + '/.omneedia-ci/api/.env',
    });
    const inquirer = require('inquirer');
    const ora = require('ora');
    const yaml = require('yaml');
    const id = require('human-readable-ids').hri;
    const chalk = require('chalk');
    const fs = require('fs');
    const shelljs = require('shelljs');

    if (args[0]) {
        var instance = 'prod';
        if (args.indexOf('--instance') > -1)
            instance = args[args.indexOf('--instance') + 1];
    }

    process.env.OMNEEDIA_APP_INSTANCE = instance;

    console.log(global.logo);

    var DEFAULT_URI =
        'https://raw.githubusercontent.com/Omneedia/templates/master/templates.json';
    var TEMPLATE_GITHUB =
        'https://raw.githubusercontent.com/{REPO}/master/${PATH}';

    var spinner = ora('Loading catalog...').start();

    function getEnv(str) {
        var result = [];
        var p = str.split('${');
        for (var i = 0; i < p.length; i++) {
            if (p[i].indexOf('}') == -1) result.push(p[i]);
            else {
                var pos = p[i].indexOf('}');
                var myvar = p[i].substr(0, pos);
                var fup = p[i].substr(pos + 1, p[i].length);
                var myvalue = process.env[myvar];
                if (!myvalue)
                    return error('environment variable ' + myvar + ' not found.');
                result.push(myvalue + fup);
            }
        }
        return result.join('');
    }

    function process_template(name, o) {
        var compose = {
            version: '3.7',
            services: {},
        };
        var spinner;

        function generate(instance, cb) {
            fs.writeFile(
                `${global.config.datastore}/.omneedia-ci/stacks/${name}.yml`,
                yaml.stringify(compose),
                function(e) {
                    spinner.succeed(`${name} created.`);
                    console.log(' ');
                    spinner = ora('starting  ' + chalk.bold(o.name) + ' ... ').start();
                    shelljs.exec(
                        `docker stack deploy -c ${global.config.datastore}/.omneedia-ci/stacks/${name}.yml ${name}`, { silent: true },
                        function(code) {
                            if (code == 0) spinner.succeed(`${name} started.`);
                            else spinner.fail(`${name} not started.`);
                            console.log(' ');
                        }
                    );
                }
            );
        }

        function handle_dynamic_volume(vol, cb) {
            var vols = [];
            for (var el in vol) vols.push({ name: el, vol: vol[el] });

            function setVolume(ndx, cbo) {
                if (!vols[ndx]) return cbo();
                var volid = `${name}_${vols[ndx].name}`;
                var voldir = `${global.config.datastore}/${volid}`;
                var ctx = vols[ndx].vol;
                var opt = ctx.mount;
                if (!opt) opt = '/opt';
                var cmd = ['docker run --rm ', '-v ' + voldir + ':' + opt];
                if (ctx.entrypoint) cmd.push('--entrypoint ' + ctx.entrypoint);
                cmd.push(ctx.image);
                cmd.push(ctx.command);
                shelljs.exec(`convoy create ${volid}`, { silent: true }, function() {
                    shelljs.exec(cmd.join(' '), { silent: true }, function(n, cmd) {
                        fs.writeFile(voldir + '/' + ctx.output, cmd, function() {
                            setVolume(ndx + 1, cbo);
                        });
                    });
                });
                return;
            }
            setVolume(0, cb);
        }

        function handle_service(tpx, ndx, cb) {
            if (!tpx[ndx]) return cb();
            var service = tpx[ndx].template;
            var el = tpx[ndx].name;
            compose.services[el] = {
                image: service.image,
            };

            function handle_environment(service, cb) {
                if (!service.environment) return cb();
                compose.services[el].env_file = `./${name}/${el}.env`;
                fs.mkdir(
                    `${global.config.datastore}/.omneedia-ci/stacks/${name}`,
                    function(e) {
                        env = [];
                        if (Array.isArray(service.environment)) {
                            for (var i = 0; i < service.environment.length; i++) {
                                var item = service.environment[i].substr(
                                    0,
                                    service.environment[i].indexOf('=')
                                );
                                var value = service.environment[i].substr(
                                    service.environment[i].indexOf('=') + 1,
                                    service.environment[i].length
                                );
                                env.push(`${item}=${value}`);
                            }
                        } else {
                            for (var item in service.environment) {
                                env.push(`${item}=${service.environment[item]}`);
                            }
                        }
                        fs.writeFile(
                            `${global.config.datastore}/.omneedia-ci/stacks/${name}/${el}.env`,
                            env.join('\n'),
                            cb
                        );
                    }
                );
            }
            if (!compose.services[el].networks) compose.services[el].networks = [];
            compose.services[el].networks.push('app');
            if (service.networks) {
                service.networks.forEach(function(s) {
                    if (s == 'public')
                        compose.networks['public'] = {
                            external: true,
                        };
                    else
                        compose.networks[s] = {
                            driver: 'overlay',
                        };
                    compose.services[el].networks.push(s);
                });
            }
            if (o.name == 'omneedia-core-web') {
                if (el == 'nginx') {
                    compose.services[el].ports = ['80:80', '443:443'];
                    compose.networks['public'] = {
                        external: true,
                    };
                }
            }
            if (service.publish) {
                compose.services[el].labels.vhost = service.publish.uri;
                compose.services[el].labels['vhost.port'] = service.publish.port;
                compose.services[el].labels['vhost.ssl'] = 1;
            }
            if (service.deploy) {
                var replica = 1;
                if (service.deploy.replica) replica = service.deploy.replica;
                if (service.deploy.replicas) replica = service.deploy.replicas;
                compose.services[el].deploy = {
                    mode: 'replicated',
                    replicas: replica,
                };
                if (service.deploy.node)
                    compose.services[el].deploy.placement = {
                        constraints: ['node.role == ' + service.deploy.node],
                    };
            }
            if (service.links) compose.services[el].depends_on = service.links;
            if (service.volumes) {
                service.volumes.forEach(function(volume) {
                    var vol = volume.split(':');
                    if (!compose.services[el].volumes) compose.services[el].volumes = [];
                    compose.services[el].volumes.push(volume);
                    if (volume.indexOf('/') != 0) {
                        if (!compose.volumes) compose.volumes = {};
                        compose.volumes[vol[0]] = {
                            driver: 'convoy',
                        };
                    }
                });
            }
            handle_environment(service, function() {
                handle_service(tpx, ndx + 1, cb);
            });
        }
        if (o.type == 4) {
            spinner = ora('configuring template ' + o.name).start();
            compose.networks = {
                app: {
                    driver: 'overlay',
                },
            };
            if (o.repository) {
                var url;
                if (o.repository.url.indexOf('github.com') > -1) {
                    url = o.repository.url.replace(
                        'https://github.com',
                        'https://raw.githubusercontent.com'
                    );
                    url += '/master';
                    url += '/' + o.repository.stackfile;
                } else return error('only github repository allowed at this time.');
            }
            if (o.stackfile) var url = o.stackfile;
            Request(url, function(e, r, template) {
                if (e) return error('not found');
                template = getEnv(template);
                template = yaml.parse(template);
                if (template.volume) {
                    handle_dynamic_volume(template.volume, function() {
                        template = template.template;
                        var templates = [];
                        for (var el in template)
                            templates.push({ name: el, template: template[el] });
                        handle_service(templates, 0, generate);
                    });
                } else {
                    template = template.template;
                    var templates = [];
                    for (var el in template)
                        templates.push({ name: el, template: template[el] });
                    handle_service(templates, 0, generate);
                }
            });

            return false;
        }

        spinner = ora('configuring drone ' + chalk.cyan.bold(name)).start();
        if (o.type == 1) {
            var volumes = [];
            var networks = [];
            compose.networks = {
                app: {
                    driver: 'overlay',
                },
            };
            networks.push('app');
            if (o.publish) {
                networks.push('public');
                compose.networks['public'] = {
                    external: true,
                };
            }
            if (o.volumes)
                o.volumes.forEach(function(vol) {
                    for (var el in vol) {
                        volumes.push(el + ':' + vol[el]);
                        if (!compose.volumes) compose.volumes = {};
                        compose.volumes[el] = {
                            driver: 'convoy',
                        };
                    }
                });
            compose.services['app'] = {
                image: o.image,
            };
            if (volumes.length > 0) compose.services['app'].volumes = volumes;
            if (networks.length > 0) compose.services['app'].networks = networks;
            if (o.env) {
                var env = [];
                for (var i = 0; i < o.env.length; i++) {
                    if (!o.env[i].set)
                        env.push({
                            type: 'input',
                            name: o.env[i].name,
                            message: o.env[i].label,
                            default: o.env[i].preset,
                        });
                }
                spinner.succeed(`${name} has been created.`);
                inquirer.prompt(env).then(function(answers) {
                    compose.services['app'].env_file = `./${name}/app.env`;
                    fs.mkdir(
                        `${global.config.datastore}/.omneedia-ci/stacks/${name}`,
                        function(e) {
                            env = [];
                            for (var el in answers) {
                                env.push(`${el}=${answers[el]}`);
                            }
                            fs.writeFile(
                                `${global.config.datastore}/.omneedia-ci/stacks/${name}/app.env`,
                                env.join('\n'),
                                generate
                            );
                        }
                    );
                });
            } else generate();
        }
    }

    Request(DEFAULT_URI, function(e, r, catalog) {
        if (e) return spinner.fail('an error has occured.');
        spinner.succeed('catalog loaded.');
        console.log(' ');
        var cat = catalog.templates;

        var categories = [];

        for (var i = 0; i < cat.length; i++) {
            if (!cat[i].name)
                cat[i].name = 'io-' + cat[i].title.toLowerCase().replace(/ /g, '-');
            if (cat[i].categories) {
                cat[i].categories.forEach(function(c) {
                    if (categories.indexOf(c) == -1) categories.push(c);
                });
            }
        }
        if (args[0]) {
            var o = cat.find((x) => x.name === args[0]);
            if (!o) return error("Can't find package");
            var name = id.random();
            if (o.categories.indexOf('omneedia core packages') > -1)
                name = o.name + '-' + instance;
            process_template(name, o);
            return;
        }
        inquirer
            .prompt([{
                type: 'list',
                name: 'category',
                message: 'Choose category',
                choices: categories,
            }, ])
            .then((answers) => {
                var template = [];

                for (var i = 0; i < cat.length; i++) {
                    if (cat[i].categories) {
                        if (cat[i].categories.indexOf(answers.category) > -1)
                            template.push(
                                cat[i].title,
                                new inquirer.Separator(cat[i].description)
                            );
                    }
                }

                inquirer
                    .prompt([{
                        type: 'list',
                        name: 'tpl',
                        message: 'Choose template',
                        choices: template,
                    }, ])
                    .then((answers) => {
                        console.log(' ');
                        var name = id.random();

                        var o = cat.find((x) => x.title === answers.tpl);
                        process_template(name, o);
                    })
                    .catch((error) => {
                        console.log(error);
                    });
            })
            .catch((error) => {
                console.log(error);
            });
    });
};