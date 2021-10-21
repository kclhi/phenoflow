'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * addColumn "restricted" to table "users"
 *
 **/

var info = {
    "revision": 2,
    "name": "privateUsers",
    "created": "2021-10-20T20:07:14.785Z",
    "comment": ""
};

var migrationCommands = [{
        fn: "addColumn",
        params: [
            "users",
            "restricted",
            {
                "type": Sequelize.BOOLEAN,
                "field": "restricted",
                "defaultValue": false
            }
        ]
    }
];

module.exports = {
    pos: 0,
    up: function(queryInterface, Sequelize)
    {
        var index = this.pos;
        return new Promise(function(resolve, reject) {
            function next() {
                if (index < migrationCommands.length)
                {
                    let command = migrationCommands[index];
                    console.log("[#"+index+"] execute: " + command.fn);
                    index++;
                    queryInterface[command.fn].apply(queryInterface, command.params).then(next, reject);
                }
                else
                    resolve();
            }
            next();
        });
    },
    info: info
};
