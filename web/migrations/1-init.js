'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "steps", deps: []
 * createTable "inputs", deps: [steps]
 * createTable "outputs", deps: [steps]
 *
 **/

var info = {
    "revision": 1,
    "name": "init",
    "created": "2020-04-01T10:12:33.132Z",
    "comment": ""
};

var migrationCommands = [{
        fn: "createTable",
        params: [
            "steps",
            {
                "id": {
                    "type": Sequelize.INTEGER,
                    "field": "id",
                    "primaryKey": true,
                    "autoIncrement": true
                },
                "workflowId": {
                    "type": Sequelize.INTEGER,
                    "field": "workflowId"
                },
                "stepId": {
                    "type": Sequelize.STRING,
                    "field": "stepId"
                },
                "doc": {
                    "type": Sequelize.STRING,
                    "field": "doc"
                },
                "type": {
                    "type": Sequelize.STRING,
                    "field": "type"
                },
                "language": {
                    "type": Sequelize.STRING,
                    "field": "language"
                },
                "position": {
                    "type": Sequelize.INTEGER,
                    "field": "position"
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
                }
            },
            {}
        ]
    },
    {
        fn: "createTable",
        params: [
            "inputs",
            {
                "id": {
                    "type": Sequelize.INTEGER,
                    "field": "id",
                    "primaryKey": true,
                    "autoIncrement": true
                },
                "inputId": {
                    "type": Sequelize.STRING,
                    "field": "inputId"
                },
                "doc": {
                    "type": Sequelize.STRING,
                    "field": "doc"
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
                "stepId": {
                    "type": Sequelize.INTEGER,
                    "field": "stepId",
                    "onUpdate": "CASCADE",
                    "onDelete": "CASCADE",
                    "references": {
                        "model": "steps",
                        "key": "id"
                    },
                    "allowNull": false
                }
            },
            {}
        ]
    },
    {
        fn: "createTable",
        params: [
            "outputs",
            {
                "id": {
                    "type": Sequelize.INTEGER,
                    "field": "id",
                    "primaryKey": true,
                    "autoIncrement": true
                },
                "outputId": {
                    "type": Sequelize.STRING,
                    "field": "outputId"
                },
                "doc": {
                    "type": Sequelize.STRING,
                    "field": "doc"
                },
                "extension": {
                    "type": Sequelize.STRING,
                    "field": "extension"
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
                "stepId": {
                    "type": Sequelize.INTEGER,
                    "field": "stepId",
                    "onUpdate": "CASCADE",
                    "onDelete": "CASCADE",
                    "references": {
                        "model": "steps",
                        "key": "id"
                    },
                    "allowNull": false
                }
            },
            {}
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
