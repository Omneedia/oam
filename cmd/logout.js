module.exports = function (args, root) {
  var error = require("../lib/utils/error");
  var fs = require("fs");
  var logSymbols = require("log-symbols");
  var logger = require("../lib/logger");
  var boxen = require("boxen");
  var chalk = require("chalk");
  console.log(
    boxen(chalk.cyan(" LOGOUT "), {
      borderStyle: "round",
      float: "center",
      borderColor: "cyan",
    })
  );
  logger(root, function (x) {
    if (!x) return error("YOU ARE NOT LOGGED IN");
    fs.unlink(root + "/.login", function (e) {
      console.log(
        "\n\t" +
          logSymbols.success +
          " " +
          chalk.green.bold("You are logged out.\n")
      );
    });
  });
};
