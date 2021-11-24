'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "dois", deps: [workflows]
 *
 **/

var info = {
    "revision": 3,
    "name": "addDOIs",
    "created": "2021-11-10T11:13:38.039Z",
    "comment": ""
};

var migrationCommands = [{
    fn: "createTable",
    params: [
        "dois",
        {
            "doi": {
                "type": Sequelize.STRING,
                "field": "doi",
                "allowNull": false,
                "primaryKey": true
            },
            "implementationHash": {
                "type": Sequelize.STRING,
                "field": "implementationHash",
                "allowNull": false,
                "primaryKey": true
            },
            "createdAt": {
                "type": Sequelize.DATE,
                "field": "createdAt",
                "allowNull": false
            },
            "updatedAt": {
                "type": Sequelize.DATE,
                "field": "updatedAt",
                "allowNull": false
            },
            "workflowId": {
                "type": Sequelize.INTEGER,
                "field": "workflowId",
                "onUpdate": "CASCADE",
                "onDelete": "SET NULL",
                "references": {
                    "model": "workflows",
                    "key": "id"
                },
                "allowNull": true
            }
        },
        {}
    ]
}];

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
