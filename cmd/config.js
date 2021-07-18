module.exports = function(args, root) {
    const prettyjson = require('prettyjson');
    const shelljs = require('shelljs');
    const logSymbols = require('log-symbols');
    const chalk = require('chalk');
    const fs = require('fs-extra');
    const boxen = require('boxen');
    const error = require('../lib/utils/error');
    const objectPath = require('object-path');
    const pgp = require('openpgp');
    const archiver = require('archiver');
    const yaml = require('yaml');
    const AdmZip = require("adm-zip");

    var NOT_BACKED_UP = [
        'OMNEEDIA_API_VERSION',
        'OMNEEDIA_TOKEN_MANAGER',
        'OMNEEDIA_TOKEN_WORKER',
        'OMNEEDIA_MANAGER_INTERFACE',
        'OMNEEDIA_ROOT_CONFIG',
        'OMNEEDIA_ROOT_NGINX',
        'OMNEEDIA_ROOT_CERTS',
        'OMNEEDIA_ROOT_LOGS',
        'OMNEEDIA_ROOT_CERTS',
    ];

    function apply_proxy(cb) {
        function config_proxy() {
            var PROXY = global.config['proxy'];
            // set proxy for npm
            shelljs.exec(
                'npm config set proxy ' + PROXY, {
                    silent: true,
                    async: true,
                },
                function() {
                    shelljs.exec(
                        'npm config set https-proxy ' + PROXY, {
                            silent: true,
                            async: true,
                        },
                        function() {
                            // set proxy for git
                            shelljs.exec(
                                'git config --global http.proxy ' + PROXY, {
                                    silent: true,
                                    async: true,
                                },
                                function() {
                                    shelljs.exec(
                                        'git config --global https.proxy ' + PROXY, {
                                            silent: true,
                                            async: true,
                                        },
                                        function() {
                                            cb();
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }

        // unset proxy for npm
        shelljs.exec(
            'npm config delete proxy', {
                silent: true,
                async: true,
            },
            function() {
                shelljs.exec(
                    'npm config delete https-proxy', {
                        silent: true,
                        async: true,
                    },
                    function() {
                        // unset proxy for git
                        shelljs.exec(
                            'git config --global core.pager cat', {
                                silent: true,
                                async: true,
                            },
                            function() {
                                shelljs.exec(
                                    'git config --global --unset http.proxy', {
                                        silent: true,
                                        async: true,
                                    },
                                    function() {
                                        shelljs.exec(
                                            'git config --global --unset https.proxy', {
                                                silent: true,
                                                async: true,
                                            },
                                            function() {
                                                if (global.config['proxy']) config_proxy();
                                                else cb();
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

    if (args[0] != 'load' && args[0] != 'save')
        console.log(
            boxen(
                chalk.cyan(
                    ' configuration: ' + chalk.cyan.bold(global.cfg.current) + ' '
                ), { float: 'left', borderStyle: 'round', borderColor: 'cyan' }
            )
        );

    if (args[0] == 'get') {
        var param = args[args.indexOf('get') + 1];
        if (!param) {
            console.log('\n' + prettyjson.render(global.config));
            console.log(' ');
        } else {
            var value = objectPath.get(global.config, param);
            console.log('\n' + chalk.green(param) + ' = ' + chalk.bold(value));
            console.log(' ');
        }
        return console.log('\n');
    }

    if (args[0] == 'set') {
        var key = args[args.indexOf('set') + 1];
        var value = args[args.indexOf('set') + 2];
        if (!key) error('You must provide a key');
        if (!value) error('You must provide a value');
        objectPath.set(global.config, key, value);
        global.cfg[global.cfg.current] = global.config;
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function() {
            apply_proxy(function() {
                console.log(
                    logSymbols.success +
                    chalk.green.bold(' OK. ') +
                    chalk.cyan(key) +
                    ' set to ' +
                    chalk.cyan(value) +
                    '\n'
                );
            });
        });
    }

    if (args[0] == 'unset') {
        var key = args[args.indexOf('unset') + 1];
        if (!key) error('You must provide a key');
        if (!global.config[key]) return error('key: ' + key + ' not found!');
        objectPath.del(global.config, key);
        global.cfg[global.cfg.current] = global.config;
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function() {
            apply_proxy(function() {
                console.log('\n' + prettyjson.render(global.config));
                console.log(' ');
                console.log(
                    logSymbols.success +
                    chalk.green.bold(' OK. ') +
                    chalk.cyan(key) +
                    ' unset' +
                    '\n'
                );
            });
        });
    }

    if (args[0] == 'save') {
        var saver = args[args.indexOf('save') + 1];
        if (!saver) error('You must provide a name');
        if (global.cfg.configs.indexOf(saver) == -1) global.cfg.configs.push(saver);
        global.cfg[saver] = global.config;
        global.config = global.cfg[saver];
        global.cfg.current = saver;
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function() {
            console.log(chalk.green('  saved to ') + chalk.green.bold(saver));
            console.log(' ');
            apply_proxy(function() {
                console.log(
                    boxen(
                        chalk.cyan(
                            ' configuration: ' + chalk.cyan.bold(global.cfg.current) + ' '
                        ), { borderStyle: 'round', borderColor: 'cyan' }
                    )
                );
                console.log('\n' + prettyjson.render(global.config));
                console.log(' ');
            });
        });
    }

    if (args[0] == 'delete') {
        var saver = args[args.indexOf('delete') + 1];
        if (!saver) error('You must provide a name');
        if (global.cfg.configs.indexOf(saver) == -1) error('config not found');
        if (global.cfg.current == saver)
            error("You can't delete the current config.");
        if (global.cfg.configs.length <= 1)
            error('You must have at least one config.');
        delete global.cfg[saver];
        global.cfg.configs.remove(saver);
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function() {
            console.log(chalk.green('  deleted. '));
            console.log(' ');
        });
    }

    if (args[0] == 'load') {
        var saver = args[args.indexOf('load') + 1];
        if (!saver) error('You must provide a name');
        if (global.cfg.configs.indexOf(saver) == -1) error('config not found');
        global.config = global.cfg[saver];
        global.cfg.current = saver;
        console.log(
            boxen(
                chalk.cyan(
                    ' configuration: ' + chalk.cyan.bold(global.cfg.current) + ' '
                ), { borderStyle: 'round', borderColor: 'cyan' }
            )
        );
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function() {
            apply_proxy(function() {
                console.log('\n' + prettyjson.render(global.config));
                console.log(' ');
            });
        });
    }

    if (args[0] == 'restore') {
        fs.readFile(
            'backup.config',
            'utf-8',
            async function(e, encrypted) {
                const publicKeyArmored = global.config.key.public;
                const privateKeyArmored = global.config.key.private;
                const passphrase = `0mneediaRulez!`;
                const publicKey = await pgp.readKey({
                    armoredKey: publicKeyArmored,
                });

                const privateKey = await pgp.decryptKey({
                    privateKey: await pgp.readPrivateKey({
                        armoredKey: privateKeyArmored,
                    }),
                    passphrase,
                });

                const encryptedMessage = await pgp.readMessage({
                    armoredMessage: encrypted,
                });

                const ooo = await pgp.decrypt({
                    message: encryptedMessage,
                    decryptionKeys: privateKey,
                    expectSigned: true,
                    verificationKeys: publicKey, // mandatory with expectSigned=true
                });
                fs.writeFile(
                    '/tmp/backup.zip',
                    Buffer.from(ooo.data, 'base64').toString('binary'),
                    'binary',
                    function() {
                        var zip = new AdmZip('/tmp/backup.zip');
                        var zipEntries = zip.getEntries(); // an array of ZipEntry records

                        zipEntries.forEach(function(zipEntry) {
                            if (zipEntry.entryName == "env") {
                                var p = zipEntry.getData().toString("utf8");
                                var o = {};
                                p = p.split('\n').forEach(function(pp) {
                                    o[pp.substr(0, pp.indexOf('='))] = pp.substr(pp.indexOf('=') + 1, pp.length);
                                });
                                fs.readFile(global.config.datastore + "/.omneedia-ci/api/.env", 'utf-8', function(e, r) {
                                    var m = {};
                                    p = r.split('\n').forEach(function(pp) {
                                        m[pp.substr(0, pp.indexOf('='))] = pp.substr(pp.indexOf('=') + 1, pp.length);
                                    });
                                    var env = {...o, ...m };
                                    var ENV = [];
                                    for (var el in env) {
                                        ENV.push(el + "=" + env[el]);
                                    }
                                    fs.writeFile(global.config.datastore + "/.omneedia-ci/api/.env", ENV.join('\n'), function(e, r) {
                                        console.log('done.');
                                    });
                                });
                            }
                            //console.log(zipEntry.toString()); // outputs zip entries information
                            zip.extractAllTo("contents", true);
                            fs.copySync("contents/omneedia-core-web-prod_certs", global.config.datastore + "/omneedia-core-web-prod_certs", { overwrite: true }, function(err) {
                                console.log('x');
                                console.log(err);
                            });
                        });
                    }
                );
                return; // 'Hello, World!'

                const { data: decrypted } = await pgp.decrypt({
                    message: encryptedMessage,
                    publicKeys: global.config.key.public,
                    privateKeys: global.config.key.private,
                    format: 'binary',
                });
                console.log(data);
                fs.writeFile(__dirname + '/../target.zip', data, function(e) {
                    console.log('done.');
                });
            }
        );
    }

    if (args[0] == 'backup') {
        function do_backup() {
            var output = fs.createWriteStream(__dirname + '/../target.zip');
            var archive = archiver('zip');
            var cert_dir = global.config.certs;
            cert_dir = cert_dir.substr(
                cert_dir.lastIndexOf('/') + 1,
                cert_dir.length
            );
            archive.directory(global.config.certs, cert_dir);
            fs.readFile(
                global.config.datastore + '/.omneedia-ci/api/.env',
                'utf-8',
                function(e, r) {
                    var env = {};
                    var tab = r.split('\n');
                    for (var i = 0; i < tab.length; i++) {
                        var name = tab[i].substr(0, tab[i].indexOf('='));
                        var value = tab[i].substr(tab[i].indexOf('=') + 1, tab[i].length);
                        env[name] = value;
                    }
                    var _env = [];
                    for (var el in env) {
                        if (NOT_BACKED_UP.indexOf(el) == -1) _env.push(el + '=' + env[el]);
                    }
                    archive.append(_env.join('\n'), { name: 'env' });
                    archive.pipe(output);
                    archive.finalize();
                    output.on('close', async function() {
                        fs.readFile(
                            __dirname + '/../target.zip',
                            async function(e, stream) {
                                var message = await pgp.createMessage({
                                    text: stream.toString('base64'),
                                });
                                var publicKey = await pgp.readKey({
                                    armoredKey: global.config.key.public,
                                });

                                var passphrase = `0mneediaRulez!`;
                                var privateKey = await pgp.decryptKey({
                                    privateKey: await pgp.readKey({
                                        armoredKey: global.config.key.private,
                                    }),
                                    passphrase,
                                });
                                const options = {
                                    message: message,
                                    encryptionKeys: publicKey,
                                    signingKeys: privateKey,

                                    format: 'binary',
                                };

                                pgp.encrypt(options).then(function(data) {
                                    fs.writeFile('backup.config', data, function() {
                                        fs.unlink(__dirname + '/../target.zip', function() {
                                            console.log('backup.config has been generated. Please keep this file in a safe place.');
                                            console.log('done.\n');
                                        });
                                    });
                                });
                            }
                        );
                    });
                }
            );
        }
        if (!global.config.key) {
            pgp
                .generateKey({
                    type: 'ecc', // Type of the key, defaults to ECC
                    curve: 'curve25519', // ECC curve name, defaults to curve25519
                    userIDs: [
                        { name: 'omneedia-backup-vault', email: 'vault@omneedia.com' },
                    ],
                    passphrase: '0mneediaRulez!',
                })
                .then(function(o) {
                    global.cfg[global.cfg.current] = global.config;
                    objectPath.set(global.config, 'key.private', o.privateKeyArmored);
                    objectPath.set(global.config, 'key.public', o.publicKeyArmored);
                    global.cfg[global.cfg.current] = global.config;
                    fs.writeFile(
                        root + '/.config',
                        JSON.stringify(global.cfg),
                        function() {
                            console.log(
                                logSymbols.success + chalk.green.bold(' OK. ') + '\n'
                            );
                        }
                    );
                });
        } else do_backup();
    }
};