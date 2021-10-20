'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * removeIndex ["language","stepId"] from table "implementations"
 * removeIndex ["stepId"] from table "inputs"
 * removeIndex ["stepId"] from table "outputs"
 * removeIndex ["position","workflowId"] from table "steps"
 * removeIndex ["name","workflowId"] from table "steps"
 * removeIndex ["name","position","workflowId"] from table "steps"
 * addColumn "restricted" to table "users"
 * changeColumn "language" on table "implementations"
 * changeColumn "position" on table "steps"
 * changeColumn "name" on table "steps"
 * addIndex "implementations_language_step_id" to table "implementations"
 * addIndex "inputs_step_id" to table "inputs"
 * addIndex "outputs_step_id" to table "outputs"
 * addIndex "steps_position_workflow_id" to table "steps"
 * addIndex "steps_name_workflow_id" to table "steps"
 * addIndex "steps_name_position_workflow_id" to table "steps"
 *
 **/

var info = {
    "revision": 2,
    "name": "privateUsers",
    "created": "2021-10-20T20:07:14.785Z",
    "comment": ""
};

var migrationCommands = [{
        fn: "removeIndex",
        params: [
            "implementations",
            ["language", "stepId"]
        ]
    },
    {
        fn: "removeIndex",
        params: [
            "inputs",
            ["stepId"]
        ]
    },
    {
        fn: "removeIndex",
        params: [
            "outputs",
            ["stepId"]
        ]
    },
    {
        fn: "removeIndex",
        params: [
            "steps",
            ["position", "workflowId"]
        ]
    },
    {
        fn: "removeIndex",
        params: [
            "steps",
            ["name", "workflowId"]
        ]
    },
    {
        fn: "removeIndex",
        params: [
            "steps",
            ["name", "position", "workflowId"]
        ]
    },
    {
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
    },
    {
        fn: "changeColumn",
        params: [
            "implementations",
            "language",
            {
                "type": Sequelize.STRING,
                "field": "language"
            }
        ]
    },
    {
        fn: "changeColumn",
        params: [
            "steps",
            "position",
            {
                "type": Sequelize.INTEGER,
                "field": "position",
                "allowNull": false
            }
        ]
    },
    {
        fn: "changeColumn",
        params: [
            "steps",
            "name",
            {
                "type": Sequelize.STRING,
                "field": "name",
                "allowNull": false
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "implementations",
            ["language", "stepId"],
            {
                "indexName": "implementations_language_step_id",
                "name": "implementations_language_step_id",
                "indicesType": "UNIQUE",
                "type": "UNIQUE"
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "inputs",
            ["stepId"],
            {
                "indexName": "inputs_step_id",
                "name": "inputs_step_id",
                "indicesType": "UNIQUE",
                "type": "UNIQUE"
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "outputs",
            ["stepId"],
            {
                "indexName": "outputs_step_id",
                "name": "outputs_step_id",
                "indicesType": "UNIQUE",
                "type": "UNIQUE"
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "steps",
            ["position", "workflowId"],
            {
                "indexName": "steps_position_workflow_id",
                "name": "steps_position_workflow_id",
                "indicesType": "UNIQUE",
                "type": "UNIQUE"
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "steps",
            ["name", "workflowId"],
            {
                "indexName": "steps_name_workflow_id",
                "name": "steps_name_workflow_id",
                "indicesType": "UNIQUE",
                "type": "UNIQUE"
            }
        ]
    },
    {
        fn: "addIndex",
        params: [
            "steps",
            ["name", "position", "workflowId"],
            {
                "indexName": "steps_name_position_workflow_id",
                "name": "steps_name_position_workflow_id",
                "indicesType": "UNIQUE",
                "type": "UNIQUE"
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
