'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "users", deps: []
 * createTable "workflows", deps: [users]
 * createTable "children", deps: [workflows, workflows]
 * createTable "steps", deps: [workflows]
 * createTable "implementations", deps: [steps]
 * createTable "inputs", deps: [steps]
 * createTable "outputs", deps: [steps]
 * addIndex ["language","stepId"] to table "implementations"
 * addIndex ["stepId"] to table "inputs"
 * addIndex ["stepId"] to table "outputs"
 * addIndex ["name","position","workflowId"] to table "steps"
 * addIndex ["name","workflowId"] to table "steps"
 * addIndex ["position","workflowId"] to table "steps"
 *
 **/

var info = {
    "revision": 1,
    "name": "init",
    "created": "2020-06-09T23:18:07.300Z",
    "comment": ""
};

var migrationCommands = [{
        fn: "createTable",
        params: [
            "users",
            {
                "name": {
                    "type": Sequelize.STRING,
                    "field": "name",
                    "allowNull": false,
                    "primaryKey": true
                },
                "password": {
                    "type": Sequelize.STRING,
                    "field": "password",
                    "allowNull": false
                },
                "verified": {
                    "type": Sequelize.BOOLEAN,
                    "field": "verified"
                },
                "homepage": {
                    "type": Sequelize.STRING,
                    "field": "homepage"
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
            "workflows",
            {
                "id": {
                    "type": Sequelize.INTEGER,
                    "field": "id",
                    "autoIncrement": true,
                    "primaryKey": true,
                    "allowNull": false
                },
                "name": {
                    "type": Sequelize.STRING,
                    "field": "name"
                },
                "about": {
                    "type": Sequelize.STRING,
                    "field": "about"
                },
                "complete": {
                    "type": Sequelize.BOOLEAN,
                    "field": "complete",
                    "defaultValue": false
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
                "userName": {
                    "type": Sequelize.STRING,
                    "field": "userName",
                    "onUpdate": "CASCADE",
                    "onDelete": "CASCADE",
                    "references": {
                        "model": "users",
                        "key": "name"
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
            "children",
            {
                "name": {
                    "type": Sequelize.STRING,
                    "field": "name"
                },
                "distinctStepName": {
                    "type": Sequelize.STRING,
                    "field": "distinctStepName"
                },
                "distinctStepPosition": {
                    "type": Sequelize.INTEGER,
                    "field": "distinctStepPosition"
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
                    "onDelete": "CASCADE",
                    "references": {
                        "model": "workflows",
                        "key": "id"
                    },
                    "primaryKey": true
                },
                "parentId": {
                    "type": Sequelize.INTEGER,
                    "field": "parentId",
                    "onUpdate": "CASCADE",
                    "onDelete": "CASCADE",
                    "references": {
                        "model": "workflows",
                        "key": "id"
                    },
                    "primaryKey": true
                }
            },
            {}
        ]
    },
    {
        fn: "createTable",
        params: [
            "steps",
            {
                "id": {
                    "type": Sequelize.INTEGER,
                    "field": "id",
                    "autoIncrement": true,
                    "primaryKey": true,
                    "allowNull": false
                },
                "name": {
                    "type": Sequelize.STRING,
                    "field": "name",
                    "allowNull": false
                },
                "doc": {
                    "type": Sequelize.STRING,
                    "field": "doc"
                },
                "type": {
                    "type": Sequelize.STRING,
                    "field": "type"
                },
                "position": {
                    "type": Sequelize.INTEGER,
                    "field": "position",
                    "allowNull": false
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
                    "onDelete": "CASCADE",
                    "references": {
                        "model": "workflows",
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
            "implementations",
            {
                "id": {
                    "type": Sequelize.INTEGER,
                    "field": "id",
                    "autoIncrement": true,
                    "primaryKey": true,
                    "allowNull": false
                },
                "language": {
                    "type": Sequelize.STRING,
                    "field": "language"
                },
                "fileName": {
                    "type": Sequelize.STRING,
                    "field": "fileName"
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
            "inputs",
            {
                "id": {
                    "type": Sequelize.INTEGER,
                    "field": "id",
                    "autoIncrement": true,
                    "primaryKey": true,
                    "allowNull": false
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
                    "autoIncrement": true,
                    "primaryKey": true,
                    "allowNull": false
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
    },
    {
        fn: "addIndex",
        params: [
            "implementations",
            ["language", "stepId"],
            {
                "indicesType": "UNIQUE",
                "unique": true
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "inputs",
            ["stepId"],
            {
                "indicesType": "UNIQUE",
                "unique": true
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "outputs",
            ["stepId"],
            {
                "indicesType": "UNIQUE",
                "unique": true
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "steps",
            ["name", "position", "workflowId"],
            {
                "indicesType": "UNIQUE",
                "unique": true
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "steps",
            ["name", "workflowId"],
            {
                "indicesType": "UNIQUE",
                "unique": true
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "steps",
            ["position", "workflowId"],
            {
                "indicesType": "UNIQUE",
                "unique": true
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
