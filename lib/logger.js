module.exports = function(root, cb) {
    var fs = require("fs");
    var jwt_decode = require("jwt-decode");
    fs.readFile(root + "/.login", "utf-8", function(e, s) {
        if (e) return cb(false);
        if (s) {
            s = JSON.parse(s);
            var token = s.token;
            try {
                var response = jwt_decode(token);
                console.log(response);
                //return;
            } catch (e) {
                return cb(false);
            }
            cb(response);
        }
    });
};