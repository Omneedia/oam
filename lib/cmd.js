module.exports = {
    "Global Commands": [{
            cmd: "login",
            description: "Log in to Omneedia",
            display: false,
        },
        {
            cmd: "logout",
            description: "Log out of Omneedia",
        },
        {
            cmd: "setup",
            description: "install omneedia platform"
        },
        {
            cmd: "install",
            description: "Install package"
        },
        {
            cmd: "config",
            description: "Manage CLI and project config values",
            text: "These commands are used to programmatically read, write, and delete CLI and     project config values.",
            subcommands: [{
                    cmd: "load",
                    description: "loading a configuration",
                },
                {
                    cmd: "save",
                    description: "saving a configuration",
                },
                {
                    cmd: "get",
                    description: "Print config values",
                },
                {
                    cmd: "set",
                    description: "Set config value",
                },
                {
                    cmd: "unset",
                    description: "Delete config value",
                },
                "delete",
            ],
        },
    ],
};