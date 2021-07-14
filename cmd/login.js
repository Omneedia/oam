module.exports = function(args, root) {
    var shelljs = require("shelljs");
    const os = require("os");
    var chalk = require("chalk");
    var fs = require("fs");
    var boxen = require("boxen");
    var error = require("../lib/utils/error");
    var logSymbols = require("log-symbols");
    var inquirer = require("inquirer");
    var logger = require("../lib/logger");

    var manager, sandbox;

    console.log(
        boxen(chalk.cyan(" LOGIN "), {
            borderStyle: "round",
            float: "center",
            borderColor: "cyan",
        })
    );

    logger(root, function(x) {
        if (x)
            return console.log(
                "\n" +
                logSymbols.success +
                " Already logged in (" +
                chalk.bold(x.info.username) +
                ")\n"
            );

        if (args.length == 0) manager = "manager.omneedia.com";
        else manager = args[0];
        if (manager.indexOf(":") > -1)
            sandbox = "http://" + manager + "/api/login/auth";
        else sandbox = "https://" + manager + "/api/login/auth";
        console.log("\nPlease log into your Omneedia account.");
        console.log(
            "If you don't have one yet, create yours by running: " +
            chalk.cyan.underline("https://console.omneedia.com")
        );
        console.log(" ");

        var questions = [{
                type: "input",
                name: "userid",
                message: "User ID:",
            },
            {
                type: "password",
                name: "password",
                message: "Password:",
            },
        ];

        inquirer.prompt(questions).then(function(answers) {
            Request({
                    url: sandbox,
                    form: {
                        u: answers.userid,
                        p: answers.password,
                    },
                    method: "post",
                    encoding: null,
                },
                function(err, resp, body) {
                    if (err) return error("SERVICE IS UNREACHABLE");
                    try {
                        var response = JSON.parse(body.toString("utf-8"));
                    } catch (e) {
                        error("SERVICE IS UNREACHABLE");
                    }
                    if (!response.token) error("LOGIN FAILED");
                    var o = {
                        api: manager,
                        token: response.token,
                    };
                    fs.writeFile(root + "/.login", JSON.stringify(o), function(e, s) {
                        console.log(
                            "\n\t" +
                            logSymbols.success +
                            " " +
                            chalk.green.bold("You are logged in.\n")
                        );
                    });
                }
            );
        });
    });
};